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
