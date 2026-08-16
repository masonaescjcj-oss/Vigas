-- 20260816120000_admin_and_key_pool.sql
-- ---------------------------------------------------------------------------
-- What the operator controls, without a deploy.
--
-- Four things move out of code and into the database:
--   plans              what each tier is allowed to do
--   models             which models users are offered
--   platform_providers the pool of API keys, used in order with failover
--   profiles.is_admin  who may change any of it
--
-- The key pool is the reason this exists: one key runs out mid-evening and
-- every user is stuck until someone redeploys. With a pool the next key takes
-- over automatically and the operator sees which one died.
-- ---------------------------------------------------------------------------

-- Ultra sits above pro. Postgres will not let a new enum value be used in the
-- same transaction that adds it, so nothing below references 'ultra' directly.
alter type public.subscription_tier add value if not exists 'ultra';

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Grants access to the admin panel. Set by hand in SQL — never by the app.';

-- ---------------------------------------------------------------------------
-- Plans: the limits behind each tier, editable without a deploy.
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  key              text primary key,
  display_name     text not null,
  -- Build runs per day. Null means unlimited.
  build_runs_per_day integer,
  -- Tokens per day. Null means unlimited.
  token_limit_per_day bigint,
  -- Projects a user may keep. Null means unlimited.
  max_projects     integer,
  -- Questions are free by design; kept as a switch in case that changes.
  chat_unlimited   boolean not null default true,
  price_label      text,
  sort_order       integer not null default 0,
  is_active        boolean not null default true,
  updated_at       timestamptz not null default now()
);

comment on table public.plans is
  'Per-tier limits. The app reads these instead of hardcoded constants.';

insert into public.plans (key, display_name, build_runs_per_day, token_limit_per_day, max_projects, price_label, sort_order)
values
  ('free',  'Free',  4,    100000, 3,    'Free',            0),
  ('pro',   'Pro',   100,  null,   null, 'Pro',             1),
  ('ultra', 'Ultra', null, null,   null, 'Ultra',           2),
  ('team',  'Team',  null, null,   null, 'Team',            3)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Models: what the picker offers. Replaces a hardcoded list in the app and an
-- ALLOWED_MODELS environment variable that needed a redeploy to change.
-- ---------------------------------------------------------------------------
create table if not exists public.models (
  id           text primary key,          -- sent verbatim to the provider
  display_name text not null,
  description  text,
  -- Which token colours the app draws it in: brandPrimary | success | warning.
  tone         text not null default 'brandPrimary',
  icon         text not null default 'zap',
  -- Lowest tier allowed to select it. Null means everyone.
  min_tier     text references public.plans (key),
  is_default   boolean not null default false,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  updated_at   timestamptz not null default now()
);

comment on table public.models is
  'Model catalogue. is_active drives both the picker and the server allow-list.';

insert into public.models (id, display_name, description, tone, icon, is_default, sort_order)
values
  ('gpt-5.6-luna',      'GPT-5.6 Luna',      'Fast general coding model', 'success',      'zap',      true,  0),
  ('deepseek-v4-flash', 'DeepSeek V4 Flash', 'Fast and economical',       'brandPrimary', 'code',     false, 1),
  ('deepseek-reasoner', 'DeepSeek Reasoner', 'Deeper reasoning',          'brandPrimary', 'sparkles', false, 2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The key pool. Same encryption as user-supplied keys: the ciphertext is
-- useless without PROVIDER_KEY_SECRET, which lives in the edge environment.
-- ---------------------------------------------------------------------------
create table if not exists public.platform_providers (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  base_url     text not null,
  key_cipher   text not null,
  key_last4    text not null,
  -- Default model for this provider when a request does not name one.
  model        text,
  -- Lower runs first. Keys from the same site share a priority and rotate.
  priority     integer not null default 100,
  is_active    boolean not null default true,

  -- Health, written by whatever used the key last.
  last_used_at timestamptz,
  last_ok_at   timestamptz,
  last_error   text,
  failure_count integer not null default 0,
  -- Set when the provider reported the key out of credit or rate-limited.
  -- Cleared by a successful test or use.
  exhausted_at timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.platform_providers is
  'Pool of platform API keys, tried in priority order with failover.';

create index if not exists idx_platform_providers_rotation
  on public.platform_providers (is_active, priority, last_used_at nulls first);

-- ---------------------------------------------------------------------------
-- Access. Plans and models are public reference data the app needs before a
-- user has any tier; the key pool is never readable by anyone but the backend.
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.models enable row level security;
alter table public.platform_providers enable row level security;

drop policy if exists "plans_readable" on public.plans;
create policy "plans_readable" on public.plans
  for select to authenticated, anon using (is_active);

drop policy if exists "plans_service_role" on public.plans;
create policy "plans_service_role" on public.plans
  for all to service_role using (true) with check (true);

drop policy if exists "models_readable" on public.models;
create policy "models_readable" on public.models
  for select to authenticated, anon using (is_active);

drop policy if exists "models_service_role" on public.models;
create policy "models_service_role" on public.models
  for all to service_role using (true) with check (true);

-- No policy for authenticated on platform_providers: only the backend touches
-- it, and a key pool is exactly the thing a leaked anon key must not reach.
drop policy if exists "platform_providers_service_role" on public.platform_providers;
create policy "platform_providers_service_role" on public.platform_providers
  for all to service_role using (true) with check (true);

revoke all on public.platform_providers from authenticated, anon;
grant select on public.plans to authenticated, anon;
grant select on public.models to authenticated, anon;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plans_updated_at on public.plans;
create trigger plans_updated_at before update on public.plans
  for each row execute function public.touch_updated_at();

drop trigger if exists models_updated_at on public.models;
create trigger models_updated_at before update on public.models
  for each row execute function public.touch_updated_at();

drop trigger if exists platform_providers_updated_at on public.platform_providers;
create trigger platform_providers_updated_at before update on public.platform_providers
  for each row execute function public.touch_updated_at();
