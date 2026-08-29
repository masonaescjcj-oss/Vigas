-- Quotas over a rolling window, and a countable record of what was spent.
--
-- Two problems with what was here.
--
-- The build allowance was per calendar day, resetting at midnight UTC. Someone
-- who wanted twice the allowance simply waited for 23:59 and took the next
-- day's as well. A rolling window has no such edge: four in any twelve hours
-- means four, whenever you ask.
--
-- Chat had no allowance at all, only a 20-per-minute burst limit, and nothing
-- recorded a chat request with a timestamp — token totals were aggregated, so
-- there was nothing to count over a window. Hence quota_events: one row per
-- accepted request, no content, just who and when.
--
-- Recording the *request* rather than the queued job is what makes the build
-- count honest. A large build hands itself on to continuation jobs, so counting
-- job_queue rows would charge someone four or five builds for asking once.
-- agent-run is only ever called by a person; continuations are inserted by the
-- worker and never touch it.

create table if not exists public.quota_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- 'build' is a run the user started; 'chat' is one question asked.
  kind       text not null check (kind in ('build', 'chat')),
  created_at timestamptz not null default now()
);

-- The only query this table serves: how many of one kind, for one user, since
-- a moment. Descending time so the window scan stops early.
create index if not exists quota_events_user_kind_time_idx
  on public.quota_events (user_id, kind, created_at desc);

alter table public.quota_events enable row level security;

-- No one reads their own rows: the count is returned by the API that enforces
-- it, and exposing the table would let a client watch its own limit approach
-- without asking. Service role only.
drop policy if exists "quota_events_service_role" on public.quota_events;
create policy "quota_events_service_role" on public.quota_events
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Plan columns. The old name said "per day" and would now be a lie.
-- ---------------------------------------------------------------------------
alter table public.plans
  add column if not exists quota_window_hours integer not null default 12
    check (quota_window_hours between 1 and 168);

alter table public.plans
  add column if not exists chat_messages_per_window integer
    check (chat_messages_per_window is null or chat_messages_per_window > 0);

alter table public.plans
  add column if not exists build_runs_per_window integer
    check (build_runs_per_window is null or build_runs_per_window > 0);

-- Carry the old daily figure over so an existing install keeps a limit rather
-- than silently becoming unlimited between this migration and the next write.
update public.plans
  set build_runs_per_window = build_runs_per_day
  where build_runs_per_window is null and build_runs_per_day is not null;

-- Null means unlimited in both columns, and is deliberate rather than missing.
comment on column public.plans.build_runs_per_window is
  'Builds allowed per quota_window_hours. Null means unlimited.';
comment on column public.plans.chat_messages_per_window is
  'Chat messages allowed per quota_window_hours. Null means unlimited.';

-- ---------------------------------------------------------------------------
-- The free tier, as decided for launch: 4 builds and 30 messages per 12 hours.
-- ---------------------------------------------------------------------------
update public.plans
  set build_runs_per_window = 4,
      chat_messages_per_window = 30,
      quota_window_hours = 12,
      chat_unlimited = false
  where key = 'free';

-- ---------------------------------------------------------------------------
-- Counting. A function rather than a client-side filter so the window is
-- computed by the database's clock, not by whichever machine happened to ask.
-- ---------------------------------------------------------------------------
create or replace function public.quota_used(
  p_user_id uuid,
  p_kind text,
  p_window_hours integer
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.quota_events e
  where e.user_id = p_user_id
    and e.kind = p_kind
    and e.created_at > now() - make_interval(hours => greatest(1, p_window_hours));
$$;

revoke execute on function public.quota_used(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.quota_used(uuid, text, integer) to service_role;

/**
 * When the oldest event in the window ages out — the moment one more is allowed.
 *
 * Returned rather than computed by the caller because "your allowance resets
 * at midnight" was the only honest thing to say about a calendar window, and a
 * rolling one deserves a real answer instead.
 */
create or replace function public.quota_next_free_at(
  p_user_id uuid,
  p_kind text,
  p_window_hours integer,
  p_limit integer
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select e.created_at + make_interval(hours => greatest(1, p_window_hours))
  from public.quota_events e
  where e.user_id = p_user_id
    and e.kind = p_kind
    and e.created_at > now() - make_interval(hours => greatest(1, p_window_hours))
  order by e.created_at desc
  offset greatest(0, p_limit - 1)
  limit 1;
$$;

revoke execute on function public.quota_next_free_at(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.quota_next_free_at(uuid, text, integer, integer) to service_role;

/**
 * Record one accepted request.
 *
 * Separate from the check so a request that is refused does not count against
 * the very allowance that refused it.
 */
create or replace function public.quota_record(p_user_id uuid, p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.quota_events (user_id, kind) values (p_user_id, p_kind);
$$;

revoke execute on function public.quota_record(uuid, text) from public, anon, authenticated;
grant execute on function public.quota_record(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Housekeeping. Nothing older than a week can affect any window, and the table
-- is write-heavy, so it is pruned rather than kept forever.
-- ---------------------------------------------------------------------------
create or replace function public.prune_quota_events()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.quota_events where created_at < now() - interval '7 days';
$$;

revoke execute on function public.prune_quota_events() from public, anon, authenticated;
grant execute on function public.prune_quota_events() to service_role, postgres;
