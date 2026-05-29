-- NEURA Supabase schema
-- Paste this into Supabase SQL Editor and run once.

-- =========================================
-- profiles: user metadata + plan + Stripe ids
-- =========================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  timezone text default 'UTC',
  plan text default 'free',
  is_admin boolean default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  onboarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migration: add is_admin column if table already exists
alter table public.profiles add column if not exists is_admin boolean default false;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile row on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================
-- zones: life zones the user has activated
-- =========================================
create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  icon text,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists zones_user_idx on public.zones(user_id);

alter table public.zones enable row level security;
drop policy if exists "zones_select_own" on public.zones;
drop policy if exists "zones_insert_own" on public.zones;
drop policy if exists "zones_update_own" on public.zones;
drop policy if exists "zones_delete_own" on public.zones;
create policy "zones_select_own" on public.zones for select using (auth.uid() = user_id);
create policy "zones_insert_own" on public.zones for insert with check (auth.uid() = user_id);
create policy "zones_update_own" on public.zones for update using (auth.uid() = user_id);
create policy "zones_delete_own" on public.zones for delete using (auth.uid() = user_id);

-- =========================================
-- tasks
-- =========================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  zone_id uuid references public.zones(id) on delete set null,
  title text not null,
  urgency text default 'low' check (urgency in ('low','med','high')),
  due_date timestamptz,
  notes text,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists tasks_user_idx on public.tasks(user_id);
create index if not exists tasks_zone_idx on public.tasks(zone_id);

alter table public.tasks enable row level security;
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_select_own" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks for update using (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks for delete using (auth.uid() = user_id);

-- =========================================
-- family_members (Family plan)
-- =========================================
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_email text not null,
  status text default 'pending' check (status in ('pending','active','removed')),
  created_at timestamptz default now()
);

create index if not exists family_owner_idx on public.family_members(owner_id);

alter table public.family_members enable row level security;
drop policy if exists "family_select_own" on public.family_members;
drop policy if exists "family_insert_own" on public.family_members;
drop policy if exists "family_update_own" on public.family_members;
drop policy if exists "family_delete_own" on public.family_members;
create policy "family_select_own" on public.family_members for select using (auth.uid() = owner_id);
create policy "family_insert_own" on public.family_members for insert with check (auth.uid() = owner_id);
create policy "family_update_own" on public.family_members for update using (auth.uid() = owner_id);
create policy "family_delete_own" on public.family_members for delete using (auth.uid() = owner_id);
