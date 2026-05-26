/**
 * Thin fetch wrapper to talk to the FastAPI backend.
 * Every request includes the Supabase session token so the backend
 * can verify the caller's identity via JWT middleware.
 */
import { supabase } from "./supabase";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL as string;

async function post<T = any>(path: string, body: any): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  createCheckoutSession: (params: { user_id: string; email: string; plan: "pro" | "family"; success_url: string; cancel_url: string }) =>
    post<{ checkout_url: string; session_id: string }>("/api/billing/create-checkout-session", params),
  openPortal: (params: { user_id: string; return_url: string }) =>
    post<{ portal_url: string }>("/api/billing/portal", params),
  verifySession: (params: { user_id: string; session_id: string }) =>
    post<{ updated: boolean; plan?: string }>("/api/billing/verify-session", params),
  aiChat: (params: { user_id: string; message: string }) =>
    post<{ reply: string }>("/api/ai/chat", params),
  aiInsight: (user_id: string) =>
    post<{ insight: string; task_title?: string; urgency?: string }>("/api/ai/insight", { user_id }),
  forecast: (user_id: string) =>
    post<{ forecast: { date: string; score: number; level: "low" | "med" | "high" }[] }>("/api/ai/forecast", { user_id }),
  deleteAccount: (user_id: string) =>
    post<{ deleted: boolean }>("/api/account/delete", { user_id }),
};
