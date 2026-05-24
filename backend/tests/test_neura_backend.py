"""NEURA backend API tests — health, config, AI, billing."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://f0b9ecf2-3d50-4126-aedc-03dcdbb8e030.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def test_user_id():
    # Random UUID — endpoints accept any uuid (no auth middleware on these)
    return str(uuid.uuid4())


# ---------- Health & Config ----------
class TestHealth:
    def test_health_ok(self, api_client):
        r = api_client.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["service"] == "neura"
        assert "ts" in data

    def test_config_returns_stripe_keys(self, api_client):
        r = api_client.get(f"{API}/config", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "stripe_publishable_key" in d
        assert d["stripe_publishable_key"].startswith("pk_")
        assert d["pro_price_id"].startswith("price_")
        assert d["family_price_id"].startswith("price_")


# ---------- AI Endpoints ----------
class TestAI:
    def test_ai_insight_empty_user(self, api_client, test_user_id):
        r = api_client.post(f"{API}/ai/insight", json={"user_id": test_user_id}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "insight" in d
        assert len(d["insight"]) > 0

    def test_ai_forecast_returns_30_days(self, api_client, test_user_id):
        r = api_client.post(f"{API}/ai/forecast", json={"user_id": test_user_id}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "forecast" in d
        assert isinstance(d["forecast"], list)
        assert len(d["forecast"]) == 30
        first = d["forecast"][0]
        assert "date" in first and "score" in first and "level" in first
        assert first["level"] in ("low", "med", "high")

    def test_ai_chat_returns_claude_reply(self, api_client, test_user_id):
        r = api_client.post(
            f"{API}/ai/chat",
            json={"user_id": test_user_id, "message": "Hi NEURA, what should I focus on today?"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "reply" in d
        assert isinstance(d["reply"], str) and len(d["reply"]) > 0

    def test_ai_chat_empty_message_rejected(self, api_client, test_user_id):
        r = api_client.post(
            f"{API}/ai/chat",
            json={"user_id": test_user_id, "message": "   "},
            timeout=15,
        )
        assert r.status_code == 400


# ---------- Billing ----------
class TestBilling:
    def test_create_checkout_session_pro(self, api_client, test_user_id):
        payload = {
            "user_id": test_user_id,
            "email": f"TEST_neura.tester+{test_user_id[:8]}@example.com",
            "plan": "pro",
            "success_url": "https://example.com/success",
            "cancel_url": "https://example.com/cancel",
        }
        r = api_client.post(f"{API}/billing/create-checkout-session", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "checkout_url" in d
        assert d["checkout_url"].startswith("https://checkout.stripe.com/")
        assert "session_id" in d

    def test_create_checkout_session_invalid_plan(self, api_client, test_user_id):
        payload = {
            "user_id": test_user_id,
            "email": "TEST_invalid@example.com",
            "plan": "invalid_plan",
            "success_url": "https://example.com/success",
            "cancel_url": "https://example.com/cancel",
        }
        r = api_client.post(f"{API}/billing/create-checkout-session", json=payload, timeout=15)
        assert r.status_code == 400

    def test_billing_portal_no_customer_returns_404(self, api_client):
        # Random user without stripe_customer_id should 404
        payload = {"user_id": str(uuid.uuid4()), "return_url": "https://example.com/back"}
        r = api_client.post(f"{API}/billing/portal", json=payload, timeout=15)
        assert r.status_code == 404

    def test_webhook_no_signature_rejected(self, api_client):
        # Webhook with no Stripe-Signature header must be rejected (400)
        r = requests.post(
            f"{API}/billing/webhook",
            data=b'{"type":"test"}',
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 400, r.text

