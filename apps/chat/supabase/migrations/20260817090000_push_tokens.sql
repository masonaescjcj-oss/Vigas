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
