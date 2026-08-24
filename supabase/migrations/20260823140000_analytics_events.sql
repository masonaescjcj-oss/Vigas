-- ---------------------------------------------------------------------------
-- Product analytics, in this project's own database.
--
-- Not PostHog or Amplitude, deliberately. The agent's system prompt promises
-- the user's work never reaches a third-party server; shipping the same users'
-- behaviour to an analytics vendor would break that promise from the other
-- direction. Keeping it here also means the data is the operator's, and there
-- is no key to rotate or bill.
--
-- What may be written is decided in src/core/analytics/events.ts: an event name
-- allow-list, and a per-event allow-list of property keys. This table only
-- enforces the parts SQL can enforce — shape, ownership and retention.
-- ---------------------------------------------------------------------------

create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  -- Null for events that happen before there is an account (a signed-out
  -- paywall view). Cascades, so deleting an account really deletes its trail.
  user_id     uuid references auth.users (id) on delete cascade,
  event       text not null,
  -- Only the keys the event declares survive the client, so this is small and
  -- carries no free text.
  properties  jsonb not null default '{}'::jsonb,
  -- Enough to segment without identifying: which build, which platform.
  platform    text,
  app_version text,
  created_at  timestamptz not null default now()
);

comment on table public.analytics_events is
  'Product funnel events. Property keys are allow-listed per event in the app; '
  'nothing user-authored is recorded.';

-- The two questions asked of this table: "this event over time" and
-- "what did one user do", the second only ever by an operator.
create index if not exists analytics_events_event_time_idx
  on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id, created_at desc)
  where user_id is not null;

alter table public.analytics_events enable row level security;

-- Insert-only for the people it is about.
--
-- No select policy for authenticated on purpose: a user reading this table
-- would be reading other people's behaviour, and a user reading their *own*
-- is a feature nobody asked for. Operators read it through the admin function,
-- which uses the service role.
drop policy if exists "analytics_insert_own" on public.analytics_events;
create policy "analytics_insert_own" on public.analytics_events
  for insert to authenticated
  with check (user_id = auth.uid());

-- Signed-out events (a paywall seen before signing up) have no uid to match,
-- so they are written with user_id null and only that.
drop policy if exists "analytics_insert_anon" on public.analytics_events;
create policy "analytics_insert_anon" on public.analytics_events
  for insert to anon
  with check (user_id is null);

drop policy if exists "analytics_service_role" on public.analytics_events;
create policy "analytics_service_role" on public.analytics_events
  for all to service_role using (true) with check (true);

grant insert on public.analytics_events to authenticated, anon;
-- Explicitly not granted: select, update, delete. An event is written once and
-- is not the writer's to revise.
revoke select, update, delete on public.analytics_events from authenticated, anon;
-- The identity column's sequence is not written directly, so no grant is needed
-- for it; `generated always` refuses a supplied id anyway.

-- ---------------------------------------------------------------------------
-- Retention. Funnel questions are asked of recent data; a year-old event
-- answers nothing and is only a liability to keep.
-- ---------------------------------------------------------------------------
create or replace function public.purge_old_analytics()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.analytics_events where created_at < now() - interval '180 days';
$$;

comment on function public.purge_old_analytics is
  'Drops analytics older than 180 days. Scheduled nightly.';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('purge-old-analytics')
      where exists (select 1 from cron.job where jobname = 'purge-old-analytics');
    perform cron.schedule(
      'purge-old-analytics',
      '30 3 * * *',
      $cron$select public.purge_old_analytics();$cron$
    );
  end if;
end;
$$;
