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
 * One-time cleanup: removes duplicate zones caused by the race condition bug.
 * Keeps the earliest-created zone for each name, deletes later duplicates.
 */
async function deduplicateZones(uid: string): Promise<void> {
  const TAG = "[deduplicateZones]";
  try {
    const { data: allZones, error } = await supabase
      .from("zones")
      .select("id, name, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    if (error || !allZones) {
      console.warn(TAG, "query failed:", error?.message);
      return;
    }

    // Group by name and find duplicates
    const seen = new Map<string, string>(); // name → first zone id
    const dupeIds: string[] = [];
    for (const z of allZones) {
      if (seen.has(z.name)) {
        dupeIds.push(z.id); // this is a duplicate — delete it
      } else {
        seen.set(z.name, z.id); // keep the first one
      }
    }

    if (dupeIds.length === 0) {
      console.log(TAG, "no duplicate zones found for user", uid);
      return;
    }

    console.log(TAG, `found ${dupeIds.length} duplicate zones, deleting:`, dupeIds);

    const { error: delErr } = await supabase
      .from("zones")
      .delete()
      .in("id", dupeIds);

    if (delErr) {
      console.error(TAG, "DELETE failed:", delErr.code, delErr.message);
    } else {
      console.log(TAG, `deleted ${dupeIds.length} duplicate zones successfully`);
    }
  } catch (e: any) {
    console.warn(TAG, "unexpected error:", e?.message);
  }
}

/**
 * Ensures the user has at least the 6 default life zones.
 * Called once after profile is loaded; skips if zones already exist.
 *
 * ⚠ Column schema must match the onboarding flow exactly:
 *   { user_id, name, color, icon, active }
 *
 * Race-condition guard: loadProfile() is called from both getSession()
 * and onAuthStateChange() on app start. Without the mutex, two concurrent
 * calls both see 0 zones and both insert 6 → 12 duplicates.
 * The _running promise acts as a per-user mutex so the second call awaits
 * the first instead of running its own check+insert.
 */
const _ensureZonesRunning = new Map<string, Promise<void>>();

async function ensureDefaultZones(uid: string): Promise<void> {
  // ── Mutex: if already in-flight for this uid, just await the same promise ──
  const inflight = _ensureZonesRunning.get(uid);
  if (inflight) {
    console.log("[ensureDefaultZones] already in-flight for", uid, "— awaiting");
    return inflight;
  }

  const work = _doEnsureDefaultZones(uid);
  _ensureZonesRunning.set(uid, work);
  try {
    await work;
  } finally {
    _ensureZonesRunning.delete(uid);
  }
}

async function _doEnsureDefaultZones(uid: string): Promise<void> {
  const TAG = "[ensureDefaultZones]";
  try {
    console.log(TAG, "checking zones for user:", uid);

    // Fetch ALL zones for this user (not limit 1) so we can see exact count
    const { data: existing, error } = await supabase
      .from("zones")
      .select("id, name")
      .eq("user_id", uid);

    if (error) {
      console.error(TAG, "SELECT failed:", error.code, error.message, error.details);
      return;
    }

    const count = existing?.length ?? 0;
    console.log(TAG, "existing zones count:", count);

    // User already has zones — nothing to do
    if (count > 0) {
      console.log(TAG, `user already has ${count} zones:`, existing!.map((z: any) => z.name).join(", "), "— skipping insert");
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

    // Deduplicate zones (one-time cleanup for the duplicate-creation bug),
    // then ensure defaults exist for users with zero zones.
    await deduplicateZones(uid);
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
