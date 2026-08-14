-- 006_subscriptions.sql
-- Billing state, synced from RevenueCat via a secure webhook. The client may
-- only READ its own row; all writes come from the backend (service_role).

create type public.subscription_status as enum ('active', 'canceled', 'expired', 'grace_period');

create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references public.profiles (id) on delete cascade,
  revenuecat_customer_id text,
  plan_id               text,
  status                public.subscription_status not null default 'active',
  current_period_end    timestamptz,
  updated_at            timestamptz not null default now()
);

comment on table public.subscriptions is 'RevenueCat-synced billing state; writable only by the backend (service_role).';

alter table public.subscriptions enable row level security;
