/**
 * Thin fetch wrapper to talk to the FastAPI backend.
 * Every request includes the Supabase session token so the backend
 * can verify the caller's identity via JWT middleware.
 */
import { supabase } from "./supabase";

const BACKEND = (process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL) as string;

/**
 * POST helper — attaches Authorization: Bearer <token> automatically.
 *
 * If a pre-fetched access token is supplied (via `opts.token`), it is
 * used directly without an extra supabase.auth.getSession() call.
 * This avoids a stale-cache race on web where getSession() can briefly
 * return null right after a page refresh even though the user IS
 * authenticated.
 */
async function post<T = any>(
  path: string,
  body: any,
  opts?: { token?: string },
): Promise<T> {
  const TAG = "[API]";

  // ── 1. Resolve the access token ─────────────────────────────────────────
  let accessToken = opts?.token;

  if (!accessToken) {
    // Fallback: fetch fresh session from Supabase auth
    console.log(TAG, "No pre-supplied token — calling supabase.auth.getSession()");
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();

    if (sessErr) {
      console.error(TAG, "getSession error:", sessErr.message);
    }

    accessToken = session?.access_token ?? undefined;
    console.log(TAG, "Session token:", accessToken ? `Present (${accessToken.slice(0, 12)}…)` : "MISSING");
  } else {
    console.log(TAG, "Using pre-supplied token:", `${accessToken.slice(0, 12)}…`);
  }

  if (!accessToken) {
    console.log(TAG, "No access token — proceeding without Authorization header (auth guard removed)");
  }

  // ── 2. Build request ────────────────────────────────────────────────────
  const url = `${BACKEND}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  console.log(TAG, `POST ${path}`);
  console.log(TAG, "Authorization header:", accessToken ? `Present (Bearer ${accessToken.slice(0, 12)}…)` : "omitted");
  console.log(TAG, "Backend URL:", BACKEND || "⚠ UNDEFINED — EXPO_PUBLIC_API_URL / EXPO_PUBLIC_BACKEND_URL not set");

  if (!BACKEND) {
    throw new Error("Backend URL not configured — set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_BACKEND_URL");
  }

  // ── 3. Execute request ──────────────────────────────────────────────────
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  console.log(TAG, `Response: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const text = await res.text();
    console.error(TAG, `Error body:`, text);

    if (res.status === 401) {
      // Token was sent but rejected — likely expired
      console.error(TAG, "401 Unauthorized — token may be expired. Attempting refresh…");
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        console.error(TAG, "Session refresh failed:", refreshErr.message);
      } else {
        console.log(TAG, "Session refreshed — retry the request");
      }
      throw new Error(`Authentication failed (401). ${text || "Token may be expired — please retry."}`);
    }

    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  createCheckoutSession: (params: { user_id: string; email: string; plan: "pro" | "family"; success_url: string; cancel_url: string }, token?: string) =>
    post<{ checkout_url: string; session_id: string }>("/api/billing/create-checkout-session", params, { token }),
  openPortal: (params: { user_id: string; return_url: string }, token?: string) =>
    post<{ portal_url: string }>("/api/billing/portal", params, { token }),
  verifySession: (params: { user_id: string; session_id: string }, token?: string) =>
    post<{ updated: boolean; plan?: string }>("/api/billing/verify-session", params, { token }),
  aiChat: (params: {
    user_id: string;
    message: string;
    context_zones?: { name: string }[];
    context_tasks?: { title: string; urgency: string; due_date: string | null }[];
  }, token?: string) =>
    post<{ reply: string }>("/api/ai/chat", params, { token }),
  aiInsight: (user_id: string, token?: string) =>
    post<{ insight: string; task_title?: string; urgency?: string }>("/api/ai/insight", { user_id }, { token }),
  forecast: (user_id: string, token?: string) =>
    post<{ forecast: { date: string; score: number; level: "low" | "med" | "high" }[] }>("/api/ai/forecast", { user_id }, { token }),
  deleteAccount: (user_id: string, token?: string) =>
    post<{ deleted: boolean }>("/api/account/delete", { user_id }, { token }),
};
