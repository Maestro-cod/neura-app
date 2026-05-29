# NEURA — Environment Variable Audit

**Date:** May 29, 2026

---

## 🚨 Critical Finding: Supabase URL Mismatch

The frontend and backend `.env` files point to **different Supabase projects**:

| File | Variable | Value |
|------|----------|-------|
| `frontend/.env` | `EXPO_PUBLIC_SUPABASE_URL` | `https://idzpjqfhahxitbapvehr.supabase.co` |
| `backend/.env` | `SUPABASE_URL` | `https://injxxpbfnlhfbmramsoj.supabase.co` |

**Impact:** The frontend authenticates against one Supabase project while the backend reads/writes data on a completely different one. JWTs from the frontend won't validate on the backend, and data will be split across two databases. **These must match.**

---

## Frontend — `frontend/.env`

| Variable | Value | Status |
|----------|-------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://idzpjqfhahxitbapvehr.supabase.co` | ✅ Real value set |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` (JWT, 236 chars) | ✅ Real value set |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` | ✅ Set (localhost — needs updating for production) |
| `EXPO_PUBLIC_BACKEND_URL` | `http://localhost:8000` | ✅ Set (alias of API_URL — localhost) |

**Frontend summary:** All 4 variables are set. No missing variables. The API URLs point to localhost which is correct for local development but will need to be updated for production/staging.

---

## Backend — `backend/.env`

### Supabase
| Variable | Value | Status |
|----------|-------|--------|
| `SUPABASE_URL` | `https://injxxpbfnlhfbmramsoj.supabase.co` | ✅ Real value set (⚠️ but different from frontend!) |
| `SUPABASE_SERVICE_ROLE_KEY` | `PLACEHOLDER_SERVICE_ROLE_KEY` | ⚠️ **Placeholder** — backend cannot start |
| `SUPABASE_JWT_SECRET` | *(missing from .env)* | ❌ **Missing** — referenced in `auth.py` line 12, backend will crash on startup |

### Stripe
| Variable | Value | Status |
|----------|-------|--------|
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_51TaVTs2dxy...` (107 chars) | ✅ Real value set (⚠️ LIVE key) |
| `STRIPE_SECRET_KEY` | `sk_live_51TaVTs2dxy...` (107 chars) | ✅ Real value set (⚠️ LIVE key) |
| `STRIPE_PRO_PRICE_ID` | `PLACEHOLDER_PRO_PRICE_ID` | ⚠️ **Placeholder** — Pro checkout will fail |
| `STRIPE_FAMILY_PRICE_ID` | `PLACEHOLDER_FAMILY_PRICE_ID` | ⚠️ **Placeholder** — Family checkout will fail |
| `STRIPE_WEBHOOK_SECRET` | `PLACEHOLDER_WEBHOOK_SECRET` | ⚠️ **Placeholder** — webhooks won't verify |

### RouteLLM (AI)
| Variable | Value | Status |
|----------|-------|--------|
| `ROUTELLM_API_KEY` | `s2_745c45dd63d04ffc9e2016572d65a97b` | ✅ Real value set & tested working |
| `ROUTELLM_BASE_URL` | `https://routellm.abacus.ai/v1` | ✅ Real value set |
| `ROUTELLM_MODEL` | `claude-sonnet-4-6` | ✅ Real value set |

### Server Config
| Variable | Value | Status |
|----------|-------|--------|
| `ALLOWED_ORIGINS` | `http://localhost:8081,http://localhost:3000,http://localhost:8000` | ✅ Set (localhost — update for production) |

---

## Summary Table

| Status | Count | Details |
|--------|-------|---------|
| ✅ Real value set | **11** | Supabase URL & anon key, API URLs, Stripe live keys, RouteLLM (3), CORS |
| ⚠️ Placeholder | **4** | `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_FAMILY_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` |
| ❌ Missing from .env | **1** | `SUPABASE_JWT_SECRET` (required by `auth.py`) |
| 🚨 Mismatch | **1** | `SUPABASE_URL` differs between frontend and backend |

---

## Action Items

### Must Fix Before Backend Can Start
1. **Add `SUPABASE_JWT_SECRET`** to `backend/.env` — get from Supabase Dashboard → Settings → API → JWT Secret
2. **Set `SUPABASE_SERVICE_ROLE_KEY`** — get from Supabase Dashboard → Settings → API → `service_role` key
3. **Align `SUPABASE_URL`** — frontend and backend must point to the same Supabase project

### Must Fix Before Stripe Works
4. **Set `STRIPE_PRO_PRICE_ID`** — get from Stripe Dashboard → Products → Pro plan → Price ID (starts with `price_`)
5. **Set `STRIPE_FAMILY_PRICE_ID`** — same, for the Family plan
6. **Set `STRIPE_WEBHOOK_SECRET`** — get from Stripe Dashboard → Webhooks → Signing secret (starts with `whsec_`)

### Production Readiness
7. **Replace localhost URLs** in both `.env` files with production domain
8. **Update `ALLOWED_ORIGINS`** to include production frontend domain
9. **Consider using test Stripe keys** (`pk_test_`, `sk_test_`) for development — currently using **LIVE** keys

---

## Where Each Variable Is Used

### Frontend
| Variable | Files |
|----------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | `src/lib/supabase.ts` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` |
| `EXPO_PUBLIC_API_URL` | `src/lib/api.ts`, `src/components/UpgradeModal.tsx` |
| `EXPO_PUBLIC_BACKEND_URL` | `src/lib/api.ts` (fallback), `app/(tabs)/settings.tsx` |

### Backend
| Variable | Files |
|----------|-------|
| `SUPABASE_URL` | `server.py` (line 31) |
| `SUPABASE_SERVICE_ROLE_KEY` | `server.py` (line 32) |
| `SUPABASE_JWT_SECRET` | `auth.py` (line 12) |
| `STRIPE_SECRET_KEY` | `server.py` (line 33) |
| `STRIPE_PRO_PRICE_ID` | `server.py` (line 34) |
| `STRIPE_FAMILY_PRICE_ID` | `server.py` (line 35) |
| `STRIPE_WEBHOOK_SECRET` | `server.py` (line 37) |
| `STRIPE_PUBLISHABLE_KEY` | `server.py` (line 100, optional `get()`) |
| `ROUTELLM_API_KEY` | `server.py` (line 38) |
| `ROUTELLM_BASE_URL` | `server.py` (line 39, optional with default) |
| `ROUTELLM_MODEL` | `server.py` (line 40, optional with default) |
| `ALLOWED_ORIGINS` | `server.py` (line 48, optional with default) |
