-- Let the worker say how long to wait before the next attempt.
--
-- fail_agent_job decided this itself: four attempts, ten then thirty then sixty
-- seconds, then give up. That is right for a run that is broken, and wrong for
-- a provider that is briefly refusing work.
--
-- Measured against the configured gateway while driving a build that spanned
-- several turns: single requests kept returning 200, but a leg carrying a long
-- transcript came back "system cpu overloaded (current: 100.0%, threshold:
-- 90%)" four times inside a hundred seconds and the whole build was marked
-- failed. The next attempt would have worked. A run that was going fine was
-- thrown away for being unlucky about timing.
--
-- The worker can tell the two apart from the error text, so it decides and the
-- database schedules. p_retry_in_seconds:
--
--   null  keep the original schedule (every existing caller)
--   > 0   retry after that many seconds
--   0     give up now
--
-- max_attempts still caps it, so a mistake in that judgement cannot retry
-- forever. Its default rises to match the longest schedule the worker can now
-- ask for; the column's own check constraint holds the real ceiling at 10.

-- The old two-argument version has to go, or a two-argument call becomes
-- ambiguous between it and the new default-carrying one.
drop function if exists public.fail_agent_job(uuid, text);

create or replace function public.fail_agent_job(
  p_job_id uuid,
  p_error text,
  p_retry_in_seconds integer default null
)
returns public.job_queue
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.job_queue;
  v_delay_seconds integer;
  v_give_up boolean;
begin
  select * into v_job from public.job_queue
  where id = p_job_id and status = 'processing'
  for update;

  if v_job.id is null then
    raise exception 'processing job % was not found', p_job_id;
  end if;

  if p_retry_in_seconds is null then
    -- Unchanged behaviour for anything that does not pass an opinion.
    v_give_up := v_job.attempts >= v_job.max_attempts;
    v_delay_seconds := case v_job.attempts when 1 then 10 when 2 then 30 else 60 end;
  else
    -- The worker's judgement, still bounded by the job's own attempt ceiling.
    v_give_up := p_retry_in_seconds <= 0 or v_job.attempts >= v_job.max_attempts;
    v_delay_seconds := least(greatest(p_retry_in_seconds, 1), 3600);
  end if;

  if v_give_up then
    update public.job_queue
    set status = 'failed', last_error = left(coalesce(p_error, 'Unknown worker failure'), 4000),
        completed_at = now(), locked_at = null, locked_by = null
    where id = p_job_id
    returning * into v_job;
  else
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

revoke execute on function public.fail_agent_job(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.fail_agent_job(uuid, text, integer) to service_role;

-- New jobs only; jobs already queued keep the ceiling they were created with.
alter table public.job_queue alter column max_attempts set default 10;
