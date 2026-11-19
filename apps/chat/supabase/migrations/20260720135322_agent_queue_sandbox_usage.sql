-- Durable agent jobs and auditable E2B sandbox consumption.

create type public.job_status as enum ('pending', 'processing', 'completed', 'failed');
create type public.sandbox_usage_status as enum ('active', 'destroyed', 'error');

create table public.job_queue (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  project_id     uuid not null references public.projects (id) on delete cascade,
  session_id     uuid not null references public.agent_sessions (id) on delete cascade,
  payload        jsonb not null,
  status         public.job_status not null default 'pending',
  attempts       integer not null default 0 check (attempts >= 0),
  max_attempts   integer not null default 4 check (max_attempts between 1 and 10),
  available_at   timestamptz not null default now(),
  locked_at      timestamptz,
  locked_by      text,
  last_error     text,
  result         jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed_at   timestamptz,
  constraint job_queue_payload_object check (jsonb_typeof(payload) = 'object')
);

create table public.sandbox_usage (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  project_id       uuid not null references public.projects (id) on delete cascade,
  session_id       uuid not null references public.agent_sessions (id) on delete cascade,
  sandbox_id       text not null,
  status           public.sandbox_usage_status not null default 'active',
  started_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds bigint not null default 0 check (duration_seconds >= 0),
  commands_count   integer not null default 0 check (commands_count >= 0),
  peak_memory_bytes bigint not null default 0 check (peak_memory_bytes >= 0),
  error_message    text
);

alter table public.job_queue enable row level security;
alter table public.sandbox_usage enable row level security;

create policy "job_queue_select_own"
  on public.job_queue for select to authenticated
  using (user_id = (select auth.uid()));

create policy "job_queue_write_service_role"
  on public.job_queue for all to service_role
  using (true) with check (true);

create policy "sandbox_usage_select_own"
  on public.sandbox_usage for select to authenticated
  using (user_id = (select auth.uid()));

create policy "sandbox_usage_write_service_role"
  on public.sandbox_usage for all to service_role
  using (true) with check (true);

create index job_queue_claim_idx
  on public.job_queue (available_at, created_at)
  where status = 'pending';
create index job_queue_user_created_idx
  on public.job_queue (user_id, created_at desc);
create unique index job_queue_one_active_session_idx
  on public.job_queue (session_id)
  where status in ('pending', 'processing');
create index sandbox_usage_user_started_idx
  on public.sandbox_usage (user_id, started_at desc);
create unique index sandbox_usage_one_active_session_idx
  on public.sandbox_usage (session_id)
  where status = 'active';

create trigger set_job_queue_updated_at
before update on public.job_queue
for each row execute function public.set_updated_at();

create or replace function public.claim_next_agent_job(p_worker_id text)
returns setof public.job_queue
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(length(trim(p_worker_id)), 0) = 0 then
    raise exception 'worker id is required';
  end if;

  select q.id into v_id
  from public.job_queue q
  where q.status = 'pending'
    and q.available_at <= now()
  order by q.available_at, q.created_at
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  return query
  update public.job_queue q
  set status = 'processing',
      attempts = q.attempts + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      last_error = null
  where q.id = v_id
  returning q.*;
end;
$$;

create or replace function public.complete_agent_job(p_job_id uuid, p_result jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.job_queue
  set status = 'completed', result = coalesce(p_result, '{}'::jsonb),
      completed_at = now(), locked_at = null, locked_by = null, last_error = null
  where id = p_job_id and status = 'processing';
$$;

create or replace function public.fail_agent_job(p_job_id uuid, p_error text)
returns public.job_queue
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.job_queue;
  v_delay_seconds integer;
begin
  select * into v_job from public.job_queue
  where id = p_job_id and status = 'processing'
  for update;

  if v_job.id is null then
    raise exception 'processing job % was not found', p_job_id;
  end if;

  if v_job.attempts >= v_job.max_attempts then
    update public.job_queue
    set status = 'failed', last_error = left(coalesce(p_error, 'Unknown worker failure'), 4000),
        completed_at = now(), locked_at = null, locked_by = null
    where id = p_job_id
    returning * into v_job;
  else
    v_delay_seconds := case v_job.attempts when 1 then 10 when 2 then 30 else 60 end;
    update public.job_queue
    set status = 'pending', last_error = left(coalesce(p_error, 'Unknown worker failure'), 4000),
        available_at = now() + make_interval(secs => v_delay_seconds),
        locked_at = null, locked_by = null
    where id = p_job_id
    returning * into v_job;
  end if;

  return v_job;
end;
$$;

revoke all on public.job_queue, public.sandbox_usage from anon;
grant select on public.job_queue, public.sandbox_usage to authenticated;
grant all on public.job_queue, public.sandbox_usage to service_role;

revoke execute on function public.claim_next_agent_job(text) from public, anon, authenticated;
revoke execute on function public.complete_agent_job(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_agent_job(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_next_agent_job(text) to service_role;
grant execute on function public.complete_agent_job(uuid, jsonb) to service_role;
grant execute on function public.fail_agent_job(uuid, text) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_queue'
  ) then
    alter publication supabase_realtime add table public.job_queue;
  end if;
end;
$$;

-- Supabase Cron supports second-based schedules. The request contains no key;
-- Postgres Vault supplies it at execution time, so no credential is stored in
-- source or in cron.job. Create matching Vault secrets named queue_worker_url
-- and queue_worker_secret during deployment.
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.invoke_queue_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'queue_worker_url' limit 1;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'queue_worker_secret' limit 1;

  if v_url is null or v_secret is null then
    raise warning 'Queue worker Vault secrets are not configured';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke execute on function public.invoke_queue_worker() from public, anon, authenticated;
grant execute on function public.invoke_queue_worker() to service_role, postgres;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'invoke-agent-queue-worker';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'invoke-agent-queue-worker',
    '10 seconds',
    'select public.invoke_queue_worker()'
  );
end;
$$;
