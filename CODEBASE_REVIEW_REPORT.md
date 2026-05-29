# NEURA App — Codebase Review Report

**Date:** May 29, 2026  
**Branch:** `codebase-review-fixes`  
**PR:** [#2](https://github.com/Maestro-cod/neura-app/pull/2)  
**Stack:** Expo SDK 54 · React Native · TypeScript · Supabase · Stripe · Claude AI

---

## Executive Summary

Full review of every screen, component, and utility in the NEURA app. **10 bugs found and fixed** — 1 critical, 4 high, 4 medium, 1 low. The most impactful issue was an environment variable mismatch that silently broke **all API calls**. Several auth redirect bugs also prevented Google OAuth and password reset from working correctly.

---

## Areas Reviewed

| Area | Files | Status |
|------|-------|--------|
| **Auth** | `login.tsx`, `signup.tsx`, `forgot.tsx` | 3 bugs fixed |
| **Onboarding** | `step1.tsx`, `step2.tsx`, `step3.tsx` | ✅ Clean |
| **Galaxy (Home)** | `index.tsx` | ✅ Clean |
| **Tasks** | `tasks.tsx` | ✅ Clean |
| **AI Chat** | `ai.tsx` | 2 bugs fixed |
| **Forecast** | `forecast.tsx` | 3 bugs fixed |
| **Settings** | `settings.tsx` | 4 bugs fixed |
| **Shared Components** | `UpgradeModal.tsx`, `GlassCard.tsx`, `TaskModal.tsx` | 1 bug fixed |
| **Lib/Utilities** | `api.ts`, `supabase.ts`, `storage.ts`, `theme.ts` | 1 bug fixed |
| **Backend** | `server.py`, `auth.py` | Reviewed (no changes — out of scope) |
| **Database Schema** | `SUPABASE_SCHEMA.sql` | Reviewed ✅ |

---

## Bugs Found & Fixed

### 🔴 Bug #1 — CRITICAL: Environment Variable Mismatch (All API Calls Broken)

**File:** `frontend/src/lib/api.ts`  
**Impact:** Every single API call fails silently — the app appears to work but shows no data.

**Root Cause:** The code references `EXPO_PUBLIC_BACKEND_URL` but the `.env` file only defines `EXPO_PUBLIC_API_URL`. The `BASE` constant resolves to `undefined`, and all `fetch()` calls go to `undefined/api/...`.

**Fix:** Added a fallback chain:
```typescript
const BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  "http://localhost:8000";
```

Also added `EXPO_PUBLIC_BACKEND_URL` as an alias in `.env` for backward compatibility.

---

### 🔴 Bug #2 — HIGH: Google OAuth Redirect Broken

**Files:** `frontend/app/auth/login.tsx`, `frontend/app/auth/signup.tsx`  
**Impact:** Google Sign-In redirects to the backend server instead of back to the app. Users get stuck after Google auth.

**Root Cause:** `redirectTo` was set to `` `${EXPO_PUBLIC_BACKEND_URL}/auth/callback` `` — pointing to the Python backend, not the Supabase auth callback or app URL.

**Fix:** Platform-aware redirect:
```typescript
const redirectTo = Platform.OS === "web"
  ? `${window.location.origin}`
  : "neura://auth/callback";
```

---

### 🔴 Bug #3 — HIGH: Password Reset Redirect Broken

**File:** `frontend/app/auth/forgot.tsx`  
**Impact:** After resetting password via email link, users are sent to the backend URL instead of back to the app.

**Fix:** Same pattern — uses `window.location.origin` on web, deep link on native.

---

### 🔴 Bug #4 — HIGH: Delete Account Confirmation Silent on Web

**File:** `frontend/app/(tabs)/settings.tsx`  
**Impact:** `Alert.alert()` is a no-op on web. Users tap "Delete Account" and nothing happens — the account could also be deleted without confirmation if the flow fell through.

**Fix:** Added platform check with `window.confirm()` fallback:
```typescript
if (Platform.OS === "web") {
  const ok = window.confirm("Delete your account? This cannot be undone.");
  if (ok) reallyDelete();
} else {
  Alert.alert("Delete Account", "...", [...]);
}
```

---

### 🔴 Bug #5 — HIGH: Null Profile Bypasses Plan Checks

**Files:** `ai.tsx`, `forecast.tsx`, `settings.tsx`  
**Impact:** When `profile` is `null` (loading or fetch failure), `profile?.plan === "free"` evaluates to `false`, incorrectly treating unauthenticated/loading users as **paid** users with access to Pro features.

**Fix:** Changed all plan checks to:
```typescript
const isFree = !profile || profile.plan === "free";
```

---

### 🟡 Bug #6 — MEDIUM: Extra Parameter in AI Chat Call

**File:** `frontend/app/(tabs)/ai.tsx`  
**Impact:** Passes `session_id` as a separate parameter to `api.aiChat()` but the function signature already includes it in the body object. TypeScript would flag this if strict checks were enabled.

**Fix:** Removed the redundant `session_id` field from the call.

---

### 🟡 Bug #7 — MEDIUM: Forecast Lock Overlay Mispositioned

**File:** `frontend/app/(tabs)/forecast.tsx`  
**Impact:** The blur/lock overlay for free users was placed *inside* the `ScrollView`. Since `StyleSheet.absoluteFillObject` positions relative to the parent, it only covers the scrollable content area, not the viewport. Users could scroll past the overlay.

**Fix:** Restructured to wrap `ScrollView` and overlay in a `flex: 1` container, with the overlay as a sibling positioned over the viewport.

---

### 🟡 Bug #8 — MEDIUM: Settings Name Input Race Condition

**File:** `frontend/app/(tabs)/settings.tsx`  
**Impact:** `useState(profile?.name ?? "")` captures the initial value of `profile` (which is `null` on first render). When the profile loads asynchronously, the name field stays empty.

**Fix:** Added a `useEffect` to sync:
```typescript
useEffect(() => {
  if (profile?.name) setName(profile.name);
}, [profile?.name]);
```

---

### 🟡 Bug #9 — MEDIUM: Customer Portal Return URL Wrong

**File:** `frontend/app/(tabs)/settings.tsx`  
**Impact:** The Stripe customer portal `return_url` used `EXPO_PUBLIC_BACKEND_URL` which may be undefined. After managing their subscription, users aren't redirected back to the app.

**Fix:** Uses `window.location.origin` on web, falls back to env var on native.

---

### 🟢 Bug #10 — LOW: Unnecessary API Call for Free Users

**File:** `frontend/app/(tabs)/forecast.tsx`  
**Impact:** Free users who can't see forecast data still trigger the API call, wasting bandwidth and potentially causing errors.

**Fix:** Added early return in `useEffect` when `isLocked` is true.

---

## Architecture Observations (No Changes Required)

### ✅ Well-Implemented
- **Supabase auth** with proper session management and `onAuthStateChange` listener
- **Stripe integration** — webhook-driven plan sync, customer portal, checkout sessions
- **Claude AI chat** — proper streaming-ready architecture, session management
- **Theme system** — consistent dark glassmorphic design tokens in `theme.ts`
- **AsyncStorage** — clean abstraction in `storage.ts` with proper JSON serialization
- **Backend JWT verification** — validates Supabase JWTs correctly with JWKS

### ⚠️ Recommendations (Not Fixed — Not Bugs)
1. **CORS:** Backend `server.py` hardcodes `localhost:8081` — needs updating for production
2. **Error toasts:** Most API errors are `console.error` only — consider user-visible error states
3. **Offline handling:** No offline detection or retry logic
4. **Rate limiting:** AI chat has no client-side rate limiting or debounce
5. **Backend `.env`:** Needs its own environment file with Supabase service role key, Stripe secret key, and Claude API key (not provided/in scope)

---

## Files Modified

| File | Changes |
|------|---------|
| `.gitignore` | Added `.metro-cache/` |
| `frontend/src/lib/api.ts` | Env var fallback chain |
| `frontend/app/auth/login.tsx` | Google OAuth redirect fix |
| `frontend/app/auth/signup.tsx` | Google OAuth redirect fix |
| `frontend/app/auth/forgot.tsx` | Password reset redirect fix |
| `frontend/app/(tabs)/ai.tsx` | Remove extra param + null plan check |
| `frontend/app/(tabs)/forecast.tsx` | Overlay positioning + skip API + null plan check |
| `frontend/app/(tabs)/settings.tsx` | Alert.alert web fix + name sync + portal URL + null plan check |
| `frontend/src/components/UpgradeModal.tsx` | Env var fix |

---

## Visual Verification

All screens tested in Expo web (port 3000):
- ✅ Login / Signup / Forgot Password
- ✅ Onboarding Steps 1–3
- ✅ Galaxy (Home) — orbit animation renders
- ✅ Tasks — modal opens, categories display
- ✅ AI Chat — input and message list render
- ✅ Forecast — lock overlay for free users displays correctly
- ✅ Settings — profile info, plan badge, all buttons functional
