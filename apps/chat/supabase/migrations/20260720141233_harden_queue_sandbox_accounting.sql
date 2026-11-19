-- Atomic sandbox accounting and recovery for workers terminated by the Edge
-- runtime before they can finalize a claimed job.

create or replace function public.record_sandbox_command(
  p_usage_id uuid,
  p_duration_seconds bigint,
  p_peak_memory_bytes bigint
)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.sandbox_usage
  set last_activity_at = now(),
      duration_seconds = duration_seconds + greatest(0, p_duration_seconds),
      commands_count = commands_count + 1,
      peak_memory_bytes = greatest(peak_memory_bytes, greatest(0, p_peak_memory_bytes))
  where id = p_usage_id and status = 'active';
$$;

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

  update public.job_queue q
  set status = case when q.attempts >= q.max_attempts then 'failed'::public.job_status else 'pending'::public.job_status end,
      available_at = case when q.attempts >= q.max_attempts then q.available_at else now() end,
      completed_at = case when q.attempts >= q.max_attempts then now() else null end,
      last_error = coalesce(q.last_error, 'Worker execution lease expired before completion.'),
      locked_at = null,
      locked_by = null
  where q.status = 'processing'
    and q.locked_at < now() - interval '10 minutes';

  select q.id into v_id
  from public.job_queue q
  where q.status = 'pending' and q.available_at <= now()
  order by q.available_at, q.created_at
  for update skip locked
  limit 1;

  if v_id is null then return; end if;

  return query
  update public.job_queue q
  set status = 'processing', attempts = q.attempts + 1,
      locked_at = now(), locked_by = p_worker_id, last_error = null
  where q.id = v_id
  returning q.*;
end;
$$;

create or replace function public.close_stale_sandbox_usage()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.sandbox_usage
  set status = 'error',
      ended_at = last_activity_at + interval '15 minutes',
      duration_seconds = greatest(duration_seconds, extract(epoch from ((last_activity_at + interval '15 minutes') - started_at))::bigint),
      error_message = coalesce(error_message, 'Sandbox expired after 15 minutes of inactivity.')
  where status = 'active'
    and last_activity_at < now() - interval '20 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.record_sandbox_command(uuid, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.close_stale_sandbox_usage() from public, anon, authenticated;
grant execute on function public.record_sandbox_command(uuid, bigint, bigint) to service_role;
grant execute on function public.close_stale_sandbox_usage() to service_role, postgres;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'close-stale-sandbox-usage';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'close-stale-sandbox-usage',
    '*/5 * * * *',
    'select public.close_stale_sandbox_usage()'
  );
end;
$$;
