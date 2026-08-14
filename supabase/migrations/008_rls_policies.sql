-- 008_rls_policies.sql
-- Row Level Security policies for every table.
--
-- Conventions (per the security spec):
--   * Every policy uses the OPTIMIZED form `(select auth.uid())` rather than a
--     bare `auth.uid()`. Wrapping the function in a scalar subselect lets the
--     planner evaluate it ONCE per query (initplan) instead of once per row,
--     which is dramatically faster on large tables under RLS.
--   * agent_sessions / agent_tasks authorize through the ownership chain
--     (project_id -> projects.user_id) using EXISTS subqueries.
--   * Sensitive tables (checkpoints, subscriptions, usage_metering) are
--     READ-ONLY to clients; all writes go through the backend (service_role,
--     which bypasses RLS). Explicit service_role policies document that intent.
--
-- RLS was already enabled in each table's migration; re-assert here to be safe.

alter table public.profiles       enable row level security;
alter table public.projects       enable row level security;
alter table public.agent_sessions enable row level security;
alter table public.agent_tasks    enable row level security;
alter table public.checkpoints    enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.usage_metering enable row level security;

-- ===========================================================================
-- profiles: a user sees and edits only their own row. Inserts happen via the
-- signup trigger (SECURITY DEFINER), so there is no client INSERT policy.
-- ===========================================================================
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ===========================================================================
-- projects: full CRUD for the owner only.
-- ===========================================================================
create policy "projects_select_own"
  on public.projects for select to authenticated
  using (user_id = (select auth.uid()));

create policy "projects_insert_own"
  on public.projects for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "projects_update_own"
  on public.projects for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "projects_delete_own"
  on public.projects for delete to authenticated
  using (user_id = (select auth.uid()));

-- ===========================================================================
-- agent_sessions: authorized through the owning project (EXISTS chain).
-- ===========================================================================
create policy "agent_sessions_select_via_project"
  on public.agent_sessions for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = agent_sessions.project_id
      and p.user_id = (select auth.uid())
  ));

create policy "agent_sessions_insert_via_project"
  on public.agent_sessions for insert to authenticated
  with check (exists (
    select 1 from public.projects p
    where p.id = agent_sessions.project_id
      and p.user_id = (select auth.uid())
  ));

create policy "agent_sessions_update_via_project"
  on public.agent_sessions for update to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = agent_sessions.project_id
      and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = agent_sessions.project_id
      and p.user_id = (select auth.uid())
  ));

create policy "agent_sessions_delete_via_project"
  on public.agent_sessions for delete to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = agent_sessions.project_id
      and p.user_id = (select auth.uid())
  ));

-- ===========================================================================
-- agent_tasks: authorized through session -> project (EXISTS chain).
-- ===========================================================================
create policy "agent_tasks_select_via_chain"
  on public.agent_tasks for select to authenticated
  using (exists (
    select 1
    from public.agent_sessions s
    join public.projects p on p.id = s.project_id
    where s.id = agent_tasks.session_id
      and p.user_id = (select auth.uid())
  ));

create policy "agent_tasks_insert_via_chain"
  on public.agent_tasks for insert to authenticated
  with check (exists (
    select 1
    from public.agent_sessions s
    join public.projects p on p.id = s.project_id
    where s.id = agent_tasks.session_id
      and p.user_id = (select auth.uid())
  ));

create policy "agent_tasks_update_via_chain"
  on public.agent_tasks for update to authenticated
  using (exists (
    select 1
    from public.agent_sessions s
    join public.projects p on p.id = s.project_id
    where s.id = agent_tasks.session_id
      and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.agent_sessions s
    join public.projects p on p.id = s.project_id
    where s.id = agent_tasks.session_id
      and p.user_id = (select auth.uid())
  ));

create policy "agent_tasks_delete_via_chain"
  on public.agent_tasks for delete to authenticated
  using (exists (
    select 1
    from public.agent_sessions s
    join public.projects p on p.id = s.project_id
    where s.id = agent_tasks.session_id
      and p.user_id = (select auth.uid())
  ));

-- ===========================================================================
-- checkpoints: owner may SELECT; only the backend (service_role) may write.
-- ===========================================================================
create policy "checkpoints_select_via_project"
  on public.checkpoints for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = checkpoints.project_id
      and p.user_id = (select auth.uid())
  ));

-- Explicit (documentary) service_role write policies. service_role bypasses RLS,
-- but declaring these makes the "backend-only writes" contract self-evident and
-- keeps behavior correct even for a non-BYPASSRLS backend role.
create policy "checkpoints_write_service_role"
  on public.checkpoints for all to service_role
  using (true) with check (true);

-- ===========================================================================
-- subscriptions: owner may SELECT; only the backend (service_role) may write.
-- ===========================================================================
create policy "subscriptions_select_own"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "subscriptions_write_service_role"
  on public.subscriptions for all to service_role
  using (true) with check (true);

-- ===========================================================================
-- usage_metering: owner may SELECT; only the backend (service_role) may write.
-- ===========================================================================
create policy "usage_metering_select_own"
  on public.usage_metering for select to authenticated
  using (user_id = (select auth.uid()));

create policy "usage_metering_write_service_role"
  on public.usage_metering for all to service_role
  using (true) with check (true);
