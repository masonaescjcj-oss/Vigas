-- 010_indexes.sql
-- Indexes for every foreign-key column referenced by an RLS policy. Without
-- these, the EXISTS/ownership checks force sequential scans and RLS becomes a
-- severe bottleneck at scale.
--
-- Note: profiles.id (PK), subscriptions.user_id (UNIQUE), and
-- usage_metering(user_id, period_start) (UNIQUE) are already backed by indexes;
-- the leading-column index on the unique constraint covers user_id lookups.

create index if not exists idx_projects_user_id
  on public.projects (user_id);

create index if not exists idx_agent_sessions_project_id
  on public.agent_sessions (project_id);

create index if not exists idx_agent_sessions_user_id
  on public.agent_sessions (user_id);

create index if not exists idx_agent_tasks_session_id
  on public.agent_tasks (session_id);

create index if not exists idx_checkpoints_project_id
  on public.checkpoints (project_id);

create index if not exists idx_checkpoints_session_id
  on public.checkpoints (session_id);

-- Webhook lookups by RevenueCat customer id.
create index if not exists idx_subscriptions_revenuecat_customer_id
  on public.subscriptions (revenuecat_customer_id);

-- Explicit user_id index for metering (redundant with the unique constraint's
-- leading column, kept for clarity of intent).
create index if not exists idx_usage_metering_user_id
  on public.usage_metering (user_id);
