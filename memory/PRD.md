# NEURA — Mental Load Management SaaS

## Overview
NEURA is a mobile-first Expo React Native app that helps users manage their mental load across life zones (Health, Home, Finance, Work, Family, Self). It pairs a cosmic galaxy-themed UI with task management, an AI assistant (Claude Sonnet 4.5), a 30-day stress forecast, and a subscription tier system (Free / Pro €9 / Family €15) via Stripe.

## Architecture
- **Frontend**: Expo SDK 54 (file-based routing via expo-router). Uses Supabase JS for auth & CRUD directly from the app.
- **Backend (FastAPI)**: Stripe checkout/portal/webhook + AI proxy (Claude via Emergent Universal Key) + account deletion + stress-forecast computation.
- **DB / Auth**: Supabase (Postgres + Auth). Tables: `profiles`, `zones`, `tasks`, `family_members`. RLS-protected — users only see their own rows.
- **Payments**: Stripe Subscriptions, opened via expo-web-browser, with `/api/billing/webhook` updating `profiles.plan`.

## Key Files
- `/app/backend/server.py` — FastAPI app
- `/app/backend/.env` — Stripe LIVE keys + Supabase + Emergent
- `/app/frontend/app/` — routes: `auth/login`, `auth/signup`, `auth/forgot`, `onboarding`, `(tabs)/galaxy|tasks|ai|forecast|settings`
- `/app/frontend/src/lib/supabase.ts` — Supabase client (SSR-safe)
- `/app/frontend/src/components/` — GalaxyCanvas, GlassCard, PrimaryButton, UrgencyBadge, ZoneChip, StressBadge, UpgradeModal
- `/app/SUPABASE_SCHEMA.sql` — DDL the user must run once in Supabase

## Setup
1. **Run SQL schema once** in Supabase SQL Editor:
   ```
   /app/SUPABASE_SCHEMA.sql
   ```
2. **Stripe webhook** (optional but recommended): Add an endpoint in Stripe Dashboard pointing to `{EXPO_PUBLIC_BACKEND_URL}/api/billing/webhook`, copy the webhook secret into `STRIPE_WEBHOOK_SECRET` in `/app/backend/.env`. Without it, the `/api/billing/verify-session` fallback still updates the plan after checkout.
3. **Stripe products**: Pro (price_1TaVYpGsJ0sItovxU9tZtihW) and Family (price_1TaVZUGsJ0sItovx8LHghOP1) must exist in the Stripe mode matching the secret key (test vs live).

## Plans & Gates
- Free: capped at 15 open tasks; AI chat and stress forecast are locked with upgrade prompts.
- Pro €9/mo: unlimited tasks, AI assistant, 30-day stress forecast.
- Family €15/mo: Pro + family members table (UI hook ready for future invite flow).

## Compliance (Google Play)
- Privacy policy link in Settings → Legal (placeholder https://neura.app/privacy)
- Subscription terms shown above checkout in the upgrade sheet.
- Account deletion (`/api/account/delete`) cancels Stripe subscription, deletes profile/zones/tasks/family rows, and removes the Supabase auth user.

## Known Limitations
- Galaxy screen is a placeholder animated starfield with `nativeID="galaxy-canvas"`. User intends to inject a true 3D WebGL layer.
- Email verification deep-link not configured — Supabase email links land on a generic page.
- Tables must be created via the included SQL file (no service-role DDL endpoint available).
