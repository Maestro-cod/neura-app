import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";

export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  timezone: string | null;
  plan: "free" | "pro" | "family";
  onboarded: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  reloadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  reloadProfile: async () => {},
  signOut: async () => {},
});

// ── Default zones auto-created for every new user ────────────────────────────
const DEFAULT_ZONES = [
  { name: "Work",    emoji: "🧠", color: "#00D4FF" },
  { name: "Home",    emoji: "🏠", color: "#FF9500" },
  { name: "Health",  emoji: "❤️", color: "#00FF88" },
  { name: "Finance", emoji: "💰", color: "#FFD700" },
  { name: "Family",  emoji: "👨‍👩‍👧", color: "#FF6B6B" },
  { name: "Self",    emoji: "🌱", color: "#8B5CF6" },
] as const;

/**
 * Ensures the user has at least the 6 default life zones.
 * Called once after profile is loaded; skips if zones already exist.
 */
async function ensureDefaultZones(uid: string): Promise<void> {
  try {
    const { data: existing, error } = await supabase
      .from("zones")
      .select("id")
      .eq("user_id", uid)
      .limit(1);

    if (error) {
      console.warn("ensureDefaultZones: check failed", error.message);
      return;
    }

    // User already has zones — nothing to do
    if (existing && existing.length > 0) return;

    // Insert the 6 default zones
    const rows = DEFAULT_ZONES.map((z) => ({
      user_id: uid,
      name: z.name,
      emoji: z.emoji,
      color: z.color,
    }));
    const { error: insertErr } = await supabase.from("zones").insert(rows);
    if (insertErr) {
      console.warn("ensureDefaultZones: insert failed", insertErr.message);
    }
  } catch (e: any) {
    console.warn("ensureDefaultZones: unexpected error", e?.message);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string | null) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (error) {
      console.warn("profile load error", error.message);
      setProfile(null);
      return;
    }
    if (!data) {
      // Insert default profile (in case trigger didn't run)
      const insert = await supabase
        .from("profiles")
        .insert({ id: uid })
        .select()
        .maybeSingle();
      setProfile((insert.data as any) ?? null);
    } else {
      setProfile(data as any);
    }

    // Ensure the user has default zones (idempotent — skips if zones exist)
    await ensureDefaultZones(uid);
  }, []);

  const reloadProfile = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      await loadProfile(data.session?.user?.id ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      await loadProfile(s?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        reloadProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
