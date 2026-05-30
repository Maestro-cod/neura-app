import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";
import { zoneColors, zoneIcons, ALL_ZONES } from "@/src/theme";

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

/**
 * Ensures the user has at least the 6 default life zones.
 * Called once after profile is loaded; skips if zones already exist.
 *
 * ⚠ Column schema must match the onboarding flow exactly:
 *   { user_id, name, color, icon, active }
 *
 * Previous bug: used a non-existent "emoji" column and omitted "active",
 * causing the INSERT to fail silently via Supabase error response.
 */
async function ensureDefaultZones(uid: string): Promise<void> {
  const TAG = "[ensureDefaultZones]";
  try {
    console.log(TAG, "checking zones for user:", uid);

    const { data: existing, error } = await supabase
      .from("zones")
      .select("id")
      .eq("user_id", uid)
      .limit(1);

    if (error) {
      console.error(TAG, "SELECT failed:", error.code, error.message, error.details);
      return;
    }

    console.log(TAG, "existing zones count:", existing?.length ?? 0);

    // User already has zones — nothing to do
    if (existing && existing.length > 0) {
      console.log(TAG, "user already has zones, skipping insert");
      return;
    }

    // Build rows matching the exact table schema (same as onboarding.tsx)
    const rows = ALL_ZONES.map((name) => ({
      user_id: uid,
      name,
      color: zoneColors[name],
      icon: zoneIcons[name],
      active: true,
    }));

    console.log(TAG, "inserting", rows.length, "default zones:", rows.map((r) => r.name).join(", "));

    const { data: inserted, error: insertErr } = await supabase
      .from("zones")
      .insert(rows)
      .select();

    if (insertErr) {
      console.error(TAG, "INSERT failed:", insertErr.code, insertErr.message, insertErr.details, insertErr.hint);
    } else {
      console.log(TAG, "INSERT success:", inserted?.length ?? 0, "zones created");
    }
  } catch (e: any) {
    console.error(TAG, "unexpected error:", e?.message, e?.stack);
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
