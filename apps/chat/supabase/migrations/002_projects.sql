-- 002_projects.sql
-- A user's coding projects. sandbox_path points at the isolated filesystem root
-- for the project in Storage.

create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  name           text not null,
  description    text,
  sandbox_path   text not null,
  last_opened_at timestamptz,
  created_at     timestamptz not null default now()
);

comment on table public.projects is 'Coding projects owned by a user; sandbox_path is the isolated Storage root.';

alter table public.projects enable row level security;
