-- 007_usage_metering.sql
-- Per-period token/request accounting used to enforce plan limits. The client
-- may only READ its own rows; all writes come from the backend (service_role).

create table public.usage_metering (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  period_start      timestamptz not null,
  period_end        timestamptz not null,
  tokens_used       bigint not null default 0,
  requests_count    integer not null default 0,
  plan_limit_tokens bigint not null default 100000,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint usage_metering_user_period_key unique (user_id, period_start)
);

comment on table public.usage_metering is 'Per-billing-period usage counters; writable only by the backend (service_role).';

alter table public.usage_metering enable row level security;
