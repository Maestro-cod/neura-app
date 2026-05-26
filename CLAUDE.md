# CLAUDE.md — NEURA App

## Project Overview

NEURA is a mobile-first mental-load management SaaS. Users organize tasks across six life zones (Health, Home, Finance, Work, Family, Self) with AI-powered chat, stress forecasting, and Stripe subscription billing.

**Hosted on:** Emergent (preview URL: `https://f0b9ecf2-3d50-4126-aedc-03dcdbb8e030.preview.emergentagent.com`)
**Repo:** `https://github.com/Maestro-cod/neura-app`

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Expo SDK 54, React Native, expo-router, TypeScript |
| Backend | FastAPI (Python 3.11), `backend/server.py` |
| Auth | Supabase (JWT via `backend/auth.py`) |
| Database | Supabase PostgreSQL + RLS (`SUPABASE_SCHEMA.sql`) |
| Payments | Stripe subscriptions |
| AI | Claude Sonnet via Emergent LLM key |

## Permissions

You have full access to this repo. You may without asking:
- Read, edit, and create any file
- Run `git add`, `git commit`, `git push origin main`
- Run `curl` to check live endpoints
- Install nothing new without confirming first

## Key Files

```
backend/
  server.py        # FastAPI app — all routes
  auth.py          # JWT middleware (get_current_user, require_self)
  requirements.txt # Python deps (all pinned)
  .env             # Local only, gitignored — NOT committed

frontend/
  src/lib/api.ts   # All backend API calls (attaches Bearer token)
  src/lib/supabase.ts  # Supabase client
  app/             # expo-router screens

SUPABASE_SCHEMA.sql  # Full DB schema with RLS policies
```

## Environment Variables

Set in Emergent dashboard (not in repo). Required:

| Variable | Where to get it |
|----------|----------------|
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Secret |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API Keys |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → API Keys |
| `STRIPE_PRO_PRICE_ID` | Stripe Dashboard → Products |
| `STRIPE_FAMILY_PRICE_ID` | Stripe Dashboard → Products |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Signing secret |
| `EMERGENT_LLM_KEY` | Emergent Dashboard |
| `ALLOWED_ORIGINS` | Set to the Emergent preview URL |

## Development Workflow

```bash
# Backend (local)
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend (local)
cd frontend
npm install
npx expo start
```

## Deployment

Emergent auto-deploys from GitHub `main` branch. After pushing:
1. Go to Emergent dashboard
2. Trigger redeploy if it doesn't auto-deploy

## Live Endpoint Check

```bash
curl -s https://f0b9ecf2-3d50-4126-aedc-03dcdbb8e030.preview.emergentagent.com/api/health
```

Expected: `{"status":"ok","service":"neura",...}`

## Auth Architecture

Every API request (except `/api/health`, `/api/config`, `/api/billing/webhook`) requires:
```
Authorization: Bearer <supabase_access_token>
```
The frontend `api.ts` attaches this automatically via `supabase.auth.getSession()`.
The backend validates via `python-jose` using `SUPABASE_JWT_SECRET` (HS256).

## Stripe Webhook

Endpoint: `POST /api/billing/webhook`
Registered at: Stripe Dashboard → Webhooks → `we_1TaWox2dxyPJTuD4O2UGNUUd`
Listens to: `checkout.session.completed`, `customer.subscription.created/updated/deleted`

## Known Issues / TODO

- Rate limiting not yet implemented on AI endpoints (`/ai/chat`, `/ai/insight`)
- `family_members(owner_id)` missing DB index
- `plan` column has no CHECK constraint (`free`/`pro`/`family`)
- `python-jose` is unmaintained — migrate to `joserfc` when time allows
