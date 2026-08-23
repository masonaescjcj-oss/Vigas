-- ---------------------------------------------------------------------------
-- Web checkout, for selling outside the app stores.
--
-- Google Play stopped requiring Play Billing after the March 2026 Epic
-- settlement, so a user can be linked to a browser to pay. This is the row that
-- survives that round trip: the app creates a session, the user disappears into
-- a payment provider, and the provider's webhook comes back minutes or hours
-- later with nothing but a reference.
--
-- Deliberately not RLS-readable by the user who owns it. A session's `status`
-- is only ever written by the service role from a verified webhook, and letting
-- the client read the row would invite a UI that trusts it — the app should ask
-- the server whether the plan is active, not read the payment's own paperwork.
-- ---------------------------------------------------------------------------

create table if not exists public.checkout_sessions (
  -- The token that travels to the provider and back. Not the user id: that
  -- would put an account identifier through a third party and a browser bar.
  reference          text primary key,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  plan_id            text not null,
  -- What was owed when the session was made, in USD cents. Recorded so a later
  -- price change cannot retroactively make a completed payment insufficient.
  amount_cents       integer not null check (amount_cents > 0),
  provider           text not null,
  -- The provider's own id for the invoice, once it gives us one.
  provider_invoice_id text,
  status             text not null default 'pending'
                       check (status in ('pending', 'paid', 'failed', 'expired')),
  -- The last provider event applied here. A retry quoting the same id is a
  -- no-op rather than another month of subscription.
  last_event_id      text,
  paid_cents         integer,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Abandoned checkouts are the common case; they should not accumulate.
  expires_at         timestamptz not null default now() + interval '24 hours'
);

comment on table public.checkout_sessions is
  'Web checkout sessions. Written only by the service role; the client never reads its own row.';

create index if not exists checkout_sessions_user_idx
  on public.checkout_sessions (user_id, created_at desc);
-- The webhook arrives knowing the provider's id, not ours.
create index if not exists checkout_sessions_provider_invoice_idx
  on public.checkout_sessions (provider, provider_invoice_id)
  where provider_invoice_id is not null;

alter table public.checkout_sessions enable row level security;

-- No policy for `authenticated` on purpose: service role bypasses RLS, and
-- everyone else gets nothing. Stated rather than left implicit, because an
-- empty policy list is indistinguishable from a forgotten one.
drop policy if exists "checkout_sessions_service_role" on public.checkout_sessions;
create policy "checkout_sessions_service_role" on public.checkout_sessions
  for all to service_role using (true) with check (true);

revoke all on public.checkout_sessions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Housekeeping: a pending session past its expiry is an abandoned cart.
-- Marked rather than deleted, so a provider that confirms very late still finds
-- the row and the amount it was quoted.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_checkouts()
returns void
language sql
security definer
set search_path = public
as $$
  update public.checkout_sessions
     set status = 'expired', updated_at = now()
   where status = 'pending' and expires_at < now();
$$;

comment on function public.expire_stale_checkouts is
  'Marks abandoned checkout sessions expired. Rows are kept so a late webhook still resolves.';
