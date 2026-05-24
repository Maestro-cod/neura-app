# NEURA 🌌

Mobile-first mental-load management SaaS. Built with Expo React Native, FastAPI, Supabase, Stripe, and Claude Sonnet 4.5.

## Stack
- **Frontend:** Expo SDK 54 + React Native + expo-router
- **Backend:** FastAPI (Python 3.11)
- **Database & Auth:** Supabase (Postgres + RLS)
- **Payments:** Stripe Subscriptions
- **AI:** Claude Sonnet 4.5 via Emergent Universal Key

## Features
- Email + password and Google OAuth (Supabase Auth)
- 3-step onboarding wizard
- Galaxy home view with floating life-zone sidebar, AI insight bar, and stress badge
- Task CRUD grouped by 6 life zones (Health · Home · Finance · Work · Family · Self)
- Claude AI chat assistant aware of the user's tasks and zones (Pro)
- 30-day stress forecast calendar (Pro)
- Free / Pro €9 / Family €15 subscription tiers via Stripe
- Settings with profile, plan management, Stripe billing portal, and account deletion (Google Play compliant)

## Setup

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # then fill in real values
uvicorn server:app --reload --port 8001
```

### 2. Frontend
```bash
cd frontend
yarn install
cp .env.example .env   # then fill in real values
npx expo start
```

### 3. Supabase
Run `SUPABASE_SCHEMA.sql` in your Supabase SQL editor once to provision tables (`profiles`, `zones`, `tasks`, `family_members`) with RLS and the new-user trigger.

### 4. Stripe
- Create Pro and Family subscription products in your Stripe dashboard.
- Put the secret key, publishable key, and both price IDs in `backend/.env`.
- Add a webhook endpoint pointing to `{your-domain}/api/billing/webhook` listening to: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`. Copy its `whsec_…` signing secret into `STRIPE_WEBHOOK_SECRET`.

## Color & Typography
- Background `#050508`, text `#e8e8f0`
- Primary gradient `#00f5a0 → #00d4ff`
- Zones: Health `#00f5a0`, Home `#7c6fff`, Finance `#f5a623`, Work `#00d4ff`, Family `#ff6b9d`, Self `#c3f53c`
- Fonts: Syne (headings), DM Sans (body)
- Glass morphism cards with 16px / 12px radii

## License
Proprietary — all rights reserved.
