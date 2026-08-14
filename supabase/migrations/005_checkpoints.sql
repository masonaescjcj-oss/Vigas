-- 005_checkpoints.sql
-- Rollback points for a project. snapshot_path references a saved snapshot in
-- Storage. Rows are SELECTable by the project owner but only WRITABLE by the
-- backend (service_role / Edge Function) — never directly from the client.

create table public.checkpoints (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  session_id    uuid references public.agent_sessions (id) on delete set null,
  snapshot_path text not null,
  created_at    timestamptz not null default now()
);

comment on table public.checkpoints is 'Project rollback snapshots; written only by the backend (service_role).';

alter table public.checkpoints enable row level security;
