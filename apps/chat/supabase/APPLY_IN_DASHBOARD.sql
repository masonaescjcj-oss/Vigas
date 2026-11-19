-- ===========================================================================
-- APPLY_IN_DASHBOARD.sql — GENERATED, do not edit.
--
-- Regenerate with:
--   npx deno run --allow-read --allow-write scripts/bundle-migrations.ts
--
-- HOW TO USE
--   Supabase dashboard -> SQL Editor -> New query -> paste all of this -> Run.
--   No CLI login, no access token and no database password are needed.
--
-- WHAT IT UNBLOCKS
--   user_providers      bring-your-own API keys
--   plans / models /
--     platform_providers the admin panel and the key pool
--   shares              public share links
--   push_tokens         build-finished notifications
--
-- Every statement is idempotent: running this twice changes nothing the second
-- time. It creates no data beyond the default plan and model rows.
--
-- AFTERWARDS, to open the admin panel for yourself (there is deliberately no
-- endpoint that grants this):
--   update public.profiles set is_admin = true where email = 'YOUR@EMAIL';
-- ===========================================================================



-- ===========================================================================
-- 20260816090000_user_providers.sql
-- ===========================================================================

-- 20260816090000_user_providers.sql
-- ---------------------------------------------------------------------------
-- Bring-your-own API key.
--
-- A user's API key is a payment instrument, so this table is written and read
-- ONLY by the backend. The client never receives the ciphertext: RLS grants
-- select on a view that omits it, and the base table grants nothing to
-- `authenticated` at all. Losing this table to a leak must not mean losing
-- anyone's billing, which is why the key is encrypted with a secret that lives
-- in the edge function's environment rather than in Postgres.
-- ---------------------------------------------------------------------------

create table if not exists public.user_providers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  -- What the user calls it: "My OpenRouter", "work key".
  label         text not null,
  -- Any OpenAI-compatible endpoint. Validated in the edge function before it
  -- is ever stored — https, a real hostname, not a private address.
  base_url      text not null,
  -- AES-GCM ciphertext, base64. Never selectable by the client.
  key_cipher    text not null,
  -- Last four characters, so the UI can show which key this is.
  key_last4     text not null,
  -- Default model id to send. Free text: a new provider's model names are not
  -- ours to enumerate.
  model         text,
  -- Set when a test call to this provider last succeeded.
  verified_at   timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.user_providers is
  'User-supplied API providers. key_cipher is encrypted by the backend; the client never reads it.';

create unique index if not exists user_providers_user_label_key
  on public.user_providers (user_id, lower(label));

create index if not exists idx_user_providers_user_id
  on public.user_providers (user_id);

alter table public.user_providers enable row level security;

-- The client gets nothing on the base table — not even select, because a
-- select policy would expose key_cipher to anyone who asks for it by name.
drop policy if exists "user_providers_service_role" on public.user_providers;
create policy "user_providers_service_role"
  on public.user_providers for all to service_role
  using (true) with check (true);

revoke all on public.user_providers from authenticated, anon;

-- What the app is allowed to see: everything except the key itself.
create or replace view public.user_providers_public
with (security_invoker = true) as
  select id, user_id, label, base_url, key_last4, model, verified_at, last_error,
         created_at, updated_at
  from public.user_providers;

comment on view public.user_providers_public is
  'user_providers without the ciphertext. This is what the app reads.';

grant select on public.user_providers_public to authenticated;

-- security_invoker means the view runs as the caller, so the base table's RLS
-- applies — and the base table denies `authenticated`. The view therefore
-- needs its own policy path: expose it through a function instead.
drop policy if exists "user_providers_owner_read" on public.user_providers;
create policy "user_providers_owner_read"
  on public.user_providers for select to authenticated
  using (user_id = auth.uid());

-- Column-level grant: the owner may read their rows, but never the ciphertext.
grant select (id, user_id, label, base_url, key_last4, model, verified_at,
              last_error, created_at, updated_at)
  on public.user_providers to authenticated;

create or replace function public.touch_user_providers_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_providers_updated_at on public.user_providers;
create trigger user_providers_updated_at
  before update on public.user_providers
  for each row execute function public.touch_user_providers_updated_at();


-- ===========================================================================
-- 20260816120000_admin_and_key_pool.sql
-- ===========================================================================

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


-- ===========================================================================
-- 20260816150000_shared_apps.sql
-- ===========================================================================

-- 20260816150000_shared_apps.sql
-- ---------------------------------------------------------------------------
-- Sharing what you built.
--
-- Someone builds something on their phone and currently cannot show it to
-- anyone. This is the growth loop the app is missing: one tap gives a public
-- URL you can send to a friend.
--
-- The document is served straight from a public Storage bucket, so there is no
-- server to run and no hosting account to sign up for. The row here is the
-- record: who owns it, which project it came from, and whether it has been
-- taken down.
-- ---------------------------------------------------------------------------

-- Deliberately PRIVATE, which is the opposite of what this migration first said.
-- Supabase Storage serves text/html as text/plain in a public bucket -- measured,
-- and deliberate on their side, so that *.supabase.co cannot host arbitrary
-- pages. A direct object URL would have shown someone's app as its own source
-- code. The share-page edge function reads the object with the service key and
-- returns it with the right content type, so nothing needs public access here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-apps', 'shared-apps', false, 2000000, array['text/html'])
on conflict (id) do update set
  public = false,
  file_size_limit = 2000000,
  allowed_mime_types = array['text/html'];

create table if not exists public.shares (
  -- A short URL-safe code, not a uuid: this ends up in a link someone types
  -- or reads aloud.
  code         text primary key,
  project_id   uuid not null references public.projects (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  title        text,
  -- Bytes of the published document, so the operator can see what is stored.
  size_bytes   integer not null default 0,
  -- Set when the owner takes it down. The row is kept so the code is never
  -- reissued to someone else.
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.shares is
  'Published snapshots of a project, served from the public shared-apps bucket.';

create index if not exists idx_shares_user on public.shares (user_id, created_at desc);
create index if not exists idx_shares_project on public.shares (project_id);

alter table public.shares enable row level security;

-- The owner may see their own shares. Nobody needs to read anyone else's row:
-- the published document is public, but who published it is not.
drop policy if exists "shares_owner_read" on public.shares;
create policy "shares_owner_read" on public.shares
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "shares_service_role" on public.shares;
create policy "shares_service_role" on public.shares
  for all to service_role using (true) with check (true);

grant select on public.shares to authenticated;

drop trigger if exists shares_updated_at on public.shares;
create trigger shares_updated_at before update on public.shares
  for each row execute function public.touch_updated_at();


-- ===========================================================================
-- 20260817090000_push_tokens.sql
-- ===========================================================================

-- 20260817090000_push_tokens.sql
-- ---------------------------------------------------------------------------
-- Where to reach a user when their build finishes.
--
-- A run takes minutes. On a phone that means the screen locks and the user goes
-- back to their life — so the app has to come and find them, or building on a
-- phone means staring at a phone.
--
-- One row per device. A device that goes away is disabled rather than deleted,
-- because the same device can come back and because a token that Expo has
-- rejected is worth keeping a record of.
-- ---------------------------------------------------------------------------

create table if not exists public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  -- The Expo push token. Unique across the table: the same physical device
  -- signing in as a second user must move, not duplicate.
  token        text not null unique,
  platform     text not null check (platform in ('ios', 'android', 'web')),
  -- Free-form device label, so "sign out this phone" can name it.
  device_name  text,
  -- Set when Expo says the device is gone. Nulled again on re-registration.
  disabled_at  timestamptz,
  last_error   text,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.push_tokens is
  'Expo push tokens, one per device. Written only through the push-register function.';

create index if not exists idx_push_tokens_user
  on public.push_tokens (user_id) where disabled_at is null;

alter table public.push_tokens enable row level security;

-- The owner may see which devices are registered, so "you have 3 devices" is
-- something the app can show truthfully.
drop policy if exists "push_tokens_owner_read" on public.push_tokens;
create policy "push_tokens_owner_read" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());

-- Writes go through the edge function only. A client that could insert rows
-- could register someone else's device against its own account, or spray tokens
-- to make the worker fan out.
drop policy if exists "push_tokens_service_role" on public.push_tokens;
create policy "push_tokens_service_role" on public.push_tokens
  for all to service_role using (true) with check (true);

grant select on public.push_tokens to authenticated;

drop trigger if exists push_tokens_updated_at on public.push_tokens;
create trigger push_tokens_updated_at before update on public.push_tokens
  for each row execute function public.touch_updated_at();


-- ===========================================================================
-- Record these as applied, so a later `supabase db push` does not replay them.
-- ===========================================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
  ) then
    insert into supabase_migrations.schema_migrations (version)
    values ('20260816090000'), ('20260816120000'), ('20260816150000'), ('20260817090000')
    on conflict (version) do nothing;
  end if;
end $$;
