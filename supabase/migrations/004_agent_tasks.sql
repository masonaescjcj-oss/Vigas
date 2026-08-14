-- 004_agent_tasks.sql
-- One row per tool/step execution within a session (audit log written by the
-- agent hooks). Authorized through session -> project -> user.

create type public.task_status as enum ('pending', 'running', 'success', 'failed');

create table public.agent_tasks (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.agent_sessions (id) on delete cascade,
  tool_name   text not null,
  tool_input  jsonb not null default '{}'::jsonb,
  tool_output jsonb,
  status      public.task_status not null default 'pending',
  duration_ms integer,
  created_at  timestamptz not null default now()
);

comment on table public.agent_tasks is 'Per-tool execution log for a session (agent audit trail).';

alter table public.agent_tasks enable row level security;
