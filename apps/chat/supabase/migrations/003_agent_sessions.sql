-- 003_agent_sessions.sql
-- Agent conversation sessions. Access is authorized through the owning project
-- (project_id -> projects.user_id); user_id is denormalized for convenience.

create type public.session_status as enum ('active', 'completed', 'failed', 'archived');

create table public.agent_sessions (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  status            public.session_status not null default 'active',
  model_provider    text not null default 'claude',
  token_usage_total bigint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.agent_sessions is 'Agent chat sessions, scoped to a project.';

alter table public.agent_sessions enable row level security;
