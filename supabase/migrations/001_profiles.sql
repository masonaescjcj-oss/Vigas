-- 001_profiles.sql
-- User profile, one row per auth user. Populated automatically on signup by the
-- handle_new_user() trigger (see 009_triggers.sql).

create type public.subscription_tier as enum ('free', 'pro', 'team');

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text,
  display_name     text,
  avatar_url       text,
  subscription_tier public.subscription_tier not null default 'free',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is 'Public profile data for each authenticated user (1:1 with auth.users).';

-- RLS on from the moment the table exists; policies are defined in 008.
alter table public.profiles enable row level security;
