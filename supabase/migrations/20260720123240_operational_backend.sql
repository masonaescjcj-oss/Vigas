-- Operational backend additions: persistent agent sessions, Storage buckets,
-- distributed rate limiting, RevenueCat idempotency, Realtime, and daily usage reset.

alter type public.session_status add value if not exists 'paused';
alter type public.session_status add value if not exists 'error';

alter table public.projects
  add column if not exists updated_at timestamptz not null default now();

alter table public.agent_sessions
  add column if not exists title text,
  add column if not exists parent_id uuid references public.agent_sessions (id) on delete set null,
  add column if not exists forked_from_index integer,
  add column if not exists profile text not null default 'standard',
  add column if not exists usage jsonb not null default '{"inputTokens":0,"outputTokens":0,"toolCalls":0,"steps":0}'::jsonb,
  add column if not exists transcript jsonb not null default '[]'::jsonb;

alter table public.agent_sessions
  drop constraint if exists agent_sessions_forked_from_index_check;
alter table public.agent_sessions
  add constraint agent_sessions_forked_from_index_check
  check (forked_from_index is null or forked_from_index >= 0);

alter table public.subscriptions
  add column if not exists grace_expires_at timestamptz,
  add column if not exists last_event_at timestamptz,
  add column if not exists last_event_id text;

create table if not exists public.revenuecat_webhook_events (
  event_id         text primary key,
  event_type       text not null,
  event_timestamp  timestamptz not null,
  payload          jsonb not null,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz
);
alter table public.revenuecat_webhook_events enable row level security;

create table if not exists public.edge_rate_limits (
  endpoint          text not null,
  rate_key          text not null,
  window_started_at timestamptz not null,
  request_count     integer not null default 1 check (request_count > 0),
  primary key (endpoint, rate_key)
);
alter table public.edge_rate_limits enable row level security;

create index if not exists idx_projects_cursor
  on public.projects (user_id, created_at desc, id desc);
create index if not exists idx_agent_sessions_parent_id
  on public.agent_sessions (parent_id);
create index if not exists idx_revenuecat_events_received_at
  on public.revenuecat_webhook_events (received_at desc);

-- Called only with the server-side secret/service key. The row lock supplied by
-- INSERT .. ON CONFLICT makes the limiter atomic across Edge Function instances.
create or replace function public.consume_edge_rate_limit(
  p_endpoint text,
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Rate-limit configuration must be positive.';
  end if;

  insert into public.edge_rate_limits as erl (
    endpoint, rate_key, window_started_at, request_count
  ) values (
    p_endpoint, p_rate_key, now(), 1
  )
  on conflict (endpoint, rate_key) do update
  set request_count = case
        when erl.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
        else erl.request_count + 1
      end,
      window_started_at = case
        when erl.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
        else erl.window_started_at
      end
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

create or replace function public.record_agent_usage(
  p_user_id uuid,
  p_tokens bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_meter_id uuid;
  v_day_start timestamptz := date_trunc('day', now());
begin
  if p_tokens < 0 then
    raise exception 'Token usage cannot be negative.';
  end if;

  select um.id into v_meter_id
  from public.usage_metering um
  where um.user_id = p_user_id
    and um.period_start <= now()
    and um.period_end > now()
  order by um.period_start desc
  limit 1
  for update;

  if v_meter_id is null then
    insert into public.usage_metering (
      user_id, period_start, period_end, tokens_used, requests_count,
      plan_limit_tokens
    ) values (
      p_user_id, v_day_start, v_day_start + interval '1 day', p_tokens, 1,
      100000
    );
  else
    update public.usage_metering
    set tokens_used = tokens_used + p_tokens,
        requests_count = requests_count + 1
    where id = v_meter_id;
  end if;
end;
$$;

-- Free-tier accounting is a UTC daily period. The job is idempotent: a second
-- invocation for the same midnight resets that day's single row.
create or replace function public.reset_free_usage_daily()
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.usage_metering (
    user_id, period_start, period_end, tokens_used, requests_count,
    plan_limit_tokens
  )
  select
    p.id,
    date_trunc('day', now()),
    date_trunc('day', now()) + interval '1 day',
    0,
    0,
    100000
  from public.profiles p
  where p.subscription_tier = 'free'
  on conflict (user_id, period_start) do update
  set period_end = excluded.period_end,
      tokens_used = 0,
      requests_count = 0,
      plan_limit_tokens = excluded.plan_limit_tokens;
$$;

-- Keep signups consistent with the daily free-tier period used by the cron job.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day_start timestamptz := date_trunc('day', now());
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.usage_metering (
    user_id, period_start, period_end, plan_limit_tokens
  ) values (
    new.id, v_day_start, v_day_start + interval '1 day', 100000
  );

  return new;
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job
  where jobname = 'reset-free-usage-midnight';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'reset-free-usage-midnight',
    '0 0 * * *',
    'select public.reset_free_usage_daily()'
  );
end;
$$;

insert into storage.buckets (id, name, public)
values
  ('project-files', 'project-files', false),
  ('agent-checkpoints', 'agent-checkpoints', false)
on conflict (id) do update set public = false;

-- Postgres Changes uses this publication; RLS on agent_tasks filters each
-- subscriber to sessions owned through its project.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'agent_tasks'
  ) then
    alter publication supabase_realtime add table public.agent_tasks;
  end if;
end;
$$;

-- Explicit Data API grants are required for projects created under Supabase's
-- 2026 secure-by-default table exposure behavior. RLS still controls rows.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.agent_sessions to authenticated;
grant select on public.agent_tasks to authenticated;
grant select on public.checkpoints to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.usage_metering to authenticated;

grant all on public.profiles, public.projects, public.agent_sessions,
  public.agent_tasks, public.checkpoints, public.subscriptions,
  public.usage_metering, public.revenuecat_webhook_events,
  public.edge_rate_limits to service_role;

revoke all on public.revenuecat_webhook_events, public.edge_rate_limits
  from anon, authenticated;
revoke execute on function public.consume_edge_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.record_agent_usage(uuid, bigint)
  from public, anon, authenticated;
revoke execute on function public.reset_free_usage_daily()
  from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, text, integer, integer)
  to service_role;
grant execute on function public.record_agent_usage(uuid, bigint)
  to service_role;
grant execute on function public.reset_free_usage_daily()
  to service_role;
