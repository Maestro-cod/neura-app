"""
NEURA backend — Stripe billing, RouteLLM AI assistant, and account management.
Supabase is the source of truth for users/profiles/tasks/zones; we use the
service-role client only for trusted server-side writes (webhook, deletion).
"""
import os
import time
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone

# Load .env FIRST — before any module that reads os.environ at import time
from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, Request, HTTPException, Header, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import stripe
from supabase import create_client, Client
from openai import AsyncOpenAI

from auth import get_current_user, require_self

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("neura")

# ---------- Config ----------
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
STRIPE_SECRET_KEY = os.environ["STRIPE_SECRET_KEY"]
STRIPE_PRO_PRICE_ID = os.environ["STRIPE_PRO_PRICE_ID"]
STRIPE_FAMILY_PRICE_ID = os.environ["STRIPE_FAMILY_PRICE_ID"]
# Webhook secret is mandatory — server refuses to start without it
STRIPE_WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]
# LLM — OpenRouter primary, NVIDIA fallback
LLM_API_KEY = (os.environ.get("OPENROUTER_API_KEY") or
               os.environ.get("NVIDIA_API_KEY") or
               os.environ.get("ROUTELLM_API_KEY", ""))
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "meta-llama/llama-3.3-70b-instruct:free")

stripe.api_key = STRIPE_SECRET_KEY
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# LLM client — OpenAI-compatible (OpenRouter, NVIDIA NIM, RouteLLM)
llm_client = AsyncOpenAI(
    api_key=LLM_API_KEY,
    base_url=LLM_BASE_URL,
    default_headers={"HTTP-Referer": "https://neura.app", "X-Title": "NEURA"},
)


app = FastAPI(title="NEURA API")
api = APIRouter(prefix="/api")

# Fix: restrict CORS to explicit origins instead of wildcard
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:8081").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Helpers ----------
def safe_table(name: str):
    return supabase.table(name)


def fetch_profile(user_id: str) -> Optional[dict]:
    try:
        r = safe_table("profiles").select("*").eq("id", user_id).maybe_single().execute()
        return r.data if r else None
    except Exception as e:
        logger.warning("fetch_profile error: %s", e)
        return None


def fetch_tasks(user_id: str, limit: int = 50) -> List[dict]:
    try:
        r = safe_table("tasks").select("*").eq("user_id", user_id).eq("completed", False).order("urgency", desc=True).limit(limit).execute()
        return r.data or []
    except Exception as e:
        logger.warning("fetch_tasks error: %s", e)
        return []


def fetch_zones(user_id: str) -> List[dict]:
    try:
        r = safe_table("zones").select("*").eq("user_id", user_id).eq("active", True).execute()
        return r.data or []
    except Exception as e:
        logger.warning("fetch_zones error: %s", e)
        return []


# ---------- Rate limiting (in-memory, per-user sliding window) ----------
# Resets on restart and is per-process — fine for a single instance. Move to
# Redis if the backend ever scales to multiple workers.
from collections import defaultdict

_AI_RATE_MAX = int(os.environ.get("AI_RATE_LIMIT_MAX", "20"))
_AI_RATE_WINDOW = int(os.environ.get("AI_RATE_LIMIT_WINDOW", "60"))
_ai_rate_hits: "defaultdict[str, list]" = defaultdict(list)


def enforce_ai_rate_limit(user_id: str) -> None:
    """Raise HTTP 429 when a user exceeds the AI request budget for the window."""
    now = time.monotonic()
    window_start = now - _AI_RATE_WINDOW
    hits = [t for t in _ai_rate_hits[user_id] if t > window_start]
    if len(hits) >= _AI_RATE_MAX:
        retry = int(_AI_RATE_WINDOW - (now - hits[0])) + 1
        raise HTTPException(
            429,
            f"You're sending messages too fast ({_AI_RATE_MAX}/{_AI_RATE_WINDOW}s). "
            f"Try again in {retry}s.",
            headers={"Retry-After": str(retry)},
        )
    hits.append(now)
    _ai_rate_hits[user_id] = hits


# ---------- Health (public) ----------
@api.get("/health")
async def health():
    return {"status": "ok", "service": "neura", "ts": datetime.now(timezone.utc).isoformat()}


@api.get("/config")
async def get_public_config():
    """Public Stripe info the client may need."""
    return {
        "stripe_publishable_key": os.environ.get("STRIPE_PUBLISHABLE_KEY", ""),
        "pro_price_id": STRIPE_PRO_PRICE_ID,
        "family_price_id": STRIPE_FAMILY_PRICE_ID,
    }


# ---------- Billing ----------
class CheckoutRequest(BaseModel):
    user_id: str
    email: str
    plan: str  # 'pro' | 'family'
    success_url: str
    cancel_url: str


@api.post("/billing/create-checkout-session")
async def create_checkout(
    payload: CheckoutRequest,
    current_user: str = Depends(get_current_user),
):
    require_self(current_user, payload.user_id)
    if payload.plan not in ("pro", "family"):
        raise HTTPException(400, "Invalid plan")
    price_id = STRIPE_PRO_PRICE_ID if payload.plan == "pro" else STRIPE_FAMILY_PRICE_ID

    profile = fetch_profile(payload.user_id) or {}
    customer_id = profile.get("stripe_customer_id")
    if not customer_id:
        customer = stripe.Customer.create(
            email=payload.email,
            metadata={"supabase_user_id": payload.user_id},
        )
        customer_id = customer["id"]
        try:
            safe_table("profiles").update({"stripe_customer_id": customer_id}).eq("id", payload.user_id).execute()
        except Exception as e:
            logger.warning("could not store stripe_customer_id: %s", e)

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=payload.success_url,
            cancel_url=payload.cancel_url,
            metadata={"supabase_user_id": payload.user_id, "plan": payload.plan},
            subscription_data={"metadata": {"supabase_user_id": payload.user_id, "plan": payload.plan}},
        )
    except Exception as e:
        logger.exception("Stripe checkout error")
        raise HTTPException(500, str(e))

    return {"checkout_url": session.url, "session_id": session.id}


class PortalRequest(BaseModel):
    user_id: str
    return_url: str


@api.post("/billing/portal")
async def billing_portal(
    payload: PortalRequest,
    current_user: str = Depends(get_current_user),
):
    require_self(current_user, payload.user_id)
    profile = fetch_profile(payload.user_id)
    if not profile or not profile.get("stripe_customer_id"):
        raise HTTPException(404, "No Stripe customer for this user.")
    try:
        session = stripe.billing_portal.Session.create(
            customer=profile["stripe_customer_id"],
            return_url=payload.return_url,
        )
    except Exception as e:
        logger.exception("Stripe portal error")
        raise HTTPException(500, str(e))
    return {"portal_url": session.url}


class VerifyRequest(BaseModel):
    user_id: str
    session_id: str


@api.post("/billing/verify-session")
async def verify_session(
    payload: VerifyRequest,
    current_user: str = Depends(get_current_user),
):
    """Client calls after success redirect to confirm plan upgrade
    without waiting for the webhook."""
    require_self(current_user, payload.user_id)
    try:
        session = stripe.checkout.Session.retrieve(payload.session_id, expand=["subscription"])
    except Exception as e:
        raise HTTPException(400, f"Could not retrieve session: {e}")

    if session.get("payment_status") not in ("paid", "no_payment_required"):
        return {"updated": False, "status": session.get("payment_status")}

    plan = session.get("metadata", {}).get("plan")
    subscription_id = session.get("subscription")
    if isinstance(subscription_id, dict):
        subscription_id = subscription_id.get("id")
    update = {"stripe_subscription_id": subscription_id}
    if plan:
        update["plan"] = plan
    try:
        safe_table("profiles").update(update).eq("id", payload.user_id).execute()
    except Exception as e:
        logger.warning("verify-session update failed: %s", e)
    return {"updated": True, "plan": plan}


# Webhook is authenticated by Stripe signature, not JWT — keep it public
@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request, stripe_signature: Optional[str] = Header(None)):
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        logger.warning("Webhook verify failed: %s", e)
        raise HTTPException(400, str(e))

    etype = event.get("type")
    obj = event.get("data", {}).get("object", {})
    logger.info("Stripe event: %s", etype)

    try:
        if etype == "checkout.session.completed":
            uid = (obj.get("metadata") or {}).get("supabase_user_id")
            plan = (obj.get("metadata") or {}).get("plan")
            sub_id = obj.get("subscription")
            cust = obj.get("customer")
            if uid:
                update = {"stripe_customer_id": cust, "stripe_subscription_id": sub_id}
                if plan:
                    update["plan"] = plan
                safe_table("profiles").update(update).eq("id", uid).execute()

        elif etype in ("customer.subscription.created", "customer.subscription.updated"):
            md = obj.get("metadata") or {}
            uid = md.get("supabase_user_id")
            status = obj.get("status")
            items = (obj.get("items") or {}).get("data", [])
            price_id = items[0]["price"]["id"] if items else None
            plan = None
            if price_id == STRIPE_PRO_PRICE_ID:
                plan = "pro"
            elif price_id == STRIPE_FAMILY_PRICE_ID:
                plan = "family"
            if status in ("canceled", "incomplete_expired", "unpaid"):
                plan = "free"
            if uid:
                update = {"stripe_subscription_id": obj.get("id")}
                if plan:
                    update["plan"] = plan
                safe_table("profiles").update(update).eq("id", uid).execute()

        elif etype == "customer.subscription.deleted":
            md = obj.get("metadata") or {}
            uid = md.get("supabase_user_id")
            if uid:
                safe_table("profiles").update({"plan": "free", "stripe_subscription_id": None}).eq("id", uid).execute()
    except Exception as e:
        logger.exception("Webhook handling error")
        return JSONResponse({"received": True, "error": str(e)}, status_code=200)

    return {"received": True}


# ---------- AI Assistant ----------
class ZoneContext(BaseModel):
    name: str

class TaskContext(BaseModel):
    title: str
    urgency: str = "low"
    due_date: Optional[str] = None

class HistoryMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    user_id: str
    message: str
    history: Optional[List[HistoryMessage]] = None
    context_zones: Optional[List[ZoneContext]] = None
    context_tasks: Optional[List[TaskContext]] = None


def build_system_prompt(
    user_id: str,
    context_zones: Optional[List[dict]] = None,
    context_tasks: Optional[List[dict]] = None,
) -> str:
    profile = fetch_profile(user_id) or {}
    zones = context_zones if context_zones is not None else fetch_zones(user_id)
    tasks = context_tasks if context_tasks is not None else fetch_tasks(user_id)

    lines = [
        "You are NEURA, a calm, supportive mental-load assistant.",
        "Help the user manage tasks across life zones. Be concise, warm, and concrete.",
        "When the user feels overwhelmed, acknowledge feelings before suggesting actions.",
        "Always reference their actual tasks and zones when relevant.",
        "To create a task for the user, include a line in your reply formatted EXACTLY as:",
        "  CREATE_TASK: title=<title> | urgency=<low|med|high> | zone=<zone name>",
        "Only include CREATE_TASK if the user clearly asks to add or create something.",
        "",
    ]
    name = profile.get("name") or "the user"
    plan = profile.get("plan", "free")
    lines.append(f"User: {name} (plan: {plan})")
    lines.append("")
    if zones:
        lines.append("Active life zones:")
        for z in zones:
            lines.append(f"- {z.get('name')}")
        lines.append("")
    if tasks:
        lines.append("Current open tasks (most urgent first):")
        for t in tasks[:20]:
            due = t.get("due_date") or "no due date"
            urg = t.get("urgency", "low")
            lines.append(f"- [{urg.upper()}] {t.get('title')} (due: {due})")
    else:
        lines.append("No open tasks yet.")
    return "\n".join(lines)


def parse_task_action(reply: str) -> Optional[dict]:
    """Extract CREATE_TASK instruction from AI reply if present."""
    import re
    match = re.search(r"CREATE_TASK:\s*title=(.+?)\s*\|\s*urgency=(\w+)\s*\|\s*zone=(.+)", reply)
    if match:
        return {
            "title": match.group(1).strip(),
            "urgency": match.group(2).strip().lower(),
            "zone_name": match.group(3).strip(),
        }
    return None


def clean_reply(reply: str) -> str:
    """Remove the CREATE_TASK line from the user-facing reply."""
    import re
    return re.sub(r"\n?CREATE_TASK:.*", "", reply).strip()


@api.post("/ai/chat")
async def ai_chat(
    payload: ChatRequest,
    current_user: str = Depends(get_current_user),
):
    require_self(current_user, payload.user_id)
    enforce_ai_rate_limit(payload.user_id)
    if not payload.message.strip():
        raise HTTPException(400, "Empty message")
    try:
        zones = [z.dict() for z in payload.context_zones] if payload.context_zones is not None else None
        tasks = [t.dict() for t in payload.context_tasks] if payload.context_tasks is not None else None
        system = build_system_prompt(payload.user_id, context_zones=zones, context_tasks=tasks)

        # Build message list with conversation history
        messages: List[dict] = [{"role": "system", "content": system}]
        if payload.history:
            for h in payload.history[-12:]:  # last 12 messages for context window
                messages.append({"role": h.role, "content": h.content})
        messages.append({"role": "user", "content": payload.message})

        response = await llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            max_tokens=800,
        )
        raw_reply = response.choices[0].message.content or ""

        # Check if AI wants to create a task
        task_created = None
        action = parse_task_action(raw_reply)
        if action:
            try:
                # Look up zone by name
                zone_row = None
                z_res = safe_table("zones").select("id,name").eq("user_id", payload.user_id).execute()
                for z in (z_res.data or []):
                    if z.get("name", "").lower() == action["zone_name"].lower():
                        zone_row = z
                        break
                insert_data = {
                    "user_id": payload.user_id,
                    "title": action["title"],
                    "urgency": action["urgency"] if action["urgency"] in ("low", "med", "high") else "med",
                    "zone_id": zone_row["id"] if zone_row else None,
                    "completed": False,
                }
                safe_table("tasks").insert(insert_data).execute()
                task_created = action["title"]
                logger.info("AI created task: %s for user %s", action["title"], payload.user_id)
            except Exception as te:
                logger.warning("Task creation failed: %s", te)

        return {
            "reply": clean_reply(raw_reply),
            "task_created": task_created,
        }
    except Exception as e:
        logger.exception("AI chat error")
        raise HTTPException(500, f"AI error: {e}")


class InsightRequest(BaseModel):
    user_id: str


@api.post("/ai/insight")
async def ai_insight(
    payload: InsightRequest,
    current_user: str = Depends(get_current_user),
):
    require_self(current_user, payload.user_id)
    enforce_ai_rate_limit(payload.user_id)
    tasks = fetch_tasks(payload.user_id)
    if not tasks:
        return {"insight": "Your mind is clear — no open tasks. Add one to start orbiting NEURA."}
    order = {"high": 3, "med": 2, "low": 1}
    top = max(tasks, key=lambda t: order.get(t.get("urgency", "low"), 0))
    title = top.get("title")
    urgency = top.get("urgency", "low")
    try:
        system = "You are NEURA, a calm assistant. Reply with ONE short sentence (max 16 words) of practical advice or encouragement for the user's most urgent task. No emojis."
        msg = f"Most urgent task: '{title}' (urgency: {urgency}). Give me one short, calm tip."
        response = await llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": msg},
            ],
            max_tokens=80,
        )
        tip = response.choices[0].message.content
        return {"insight": tip.strip(), "task_title": title, "urgency": urgency}
    except Exception as e:
        logger.warning("AI insight fallback: %s", e)
        return {"insight": f"Focus on '{title}' next — small step beats overwhelm.", "task_title": title, "urgency": urgency}


# ---------- Stress Forecast ----------
class ForecastRequest(BaseModel):
    user_id: str


@api.post("/ai/forecast")
async def stress_forecast(
    payload: ForecastRequest,
    current_user: str = Depends(get_current_user),
):
    """Compute a 30-day stress forecast based on task due dates and urgency."""
    require_self(current_user, payload.user_id)
    from collections import defaultdict
    import datetime as dt
    today = dt.date.today()
    days = [today + dt.timedelta(days=i) for i in range(30)]
    bucket = defaultdict(float)
    try:
        r = safe_table("tasks").select("*").eq("user_id", payload.user_id).eq("completed", False).execute()
        tasks = r.data or []
    except Exception:
        tasks = []
    weight = {"low": 1, "med": 2, "high": 4}
    for t in tasks:
        due = t.get("due_date")
        if not due:
            continue
        try:
            d = dt.datetime.fromisoformat(due.replace("Z", "+00:00")).date()
        except Exception:
            continue
        if today <= d <= days[-1]:
            bucket[d.isoformat()] += weight.get(t.get("urgency", "low"), 1)
    out = []
    for d in days:
        score = bucket.get(d.isoformat(), 0)
        if score >= 5:
            level = "high"
        elif score >= 2:
            level = "med"
        else:
            level = "low"
        out.append({"date": d.isoformat(), "score": score, "level": level})
    return {"forecast": out}


# ---------- Account ----------
class DeleteAccountRequest(BaseModel):
    user_id: str


@api.post("/account/delete")
async def delete_account(
    payload: DeleteAccountRequest,
    current_user: str = Depends(get_current_user),
):
    """Permanently delete user + all their data."""
    require_self(current_user, payload.user_id)
    uid = payload.user_id
    profile = fetch_profile(uid)
    if profile and profile.get("stripe_subscription_id"):
        try:
            stripe.Subscription.delete(profile["stripe_subscription_id"])
        except Exception as e:
            logger.warning("Could not cancel sub: %s", e)
    for tbl in ("tasks", "zones", "family_members", "profiles"):
        try:
            safe_table(tbl).delete().eq("user_id" if tbl != "profiles" else "id", uid).execute()
        except Exception as e:
            logger.warning("delete %s failed: %s", tbl, e)
    try:
        supabase.auth.admin.delete_user(uid)
    except Exception as e:
        logger.warning("delete auth user failed: %s", e)
    return {"deleted": True}


app.include_router(api)


@app.get("/")
async def root():
    return {"service": "NEURA API", "status": "ok"}
