-- 009_triggers.sql
-- Signup automation and updated_at maintenance.

-- ---------------------------------------------------------------------------
-- updated_at: bump on every UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger trg_agent_sessions_updated_at
  before update on public.agent_sessions
  for each row execute function public.set_updated_at();

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger trg_usage_metering_updated_at
  before update on public.usage_metering
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- On signup: create the profile and an initial free-tier metering period.
-- SECURITY DEFINER so it can write regardless of RLS; search_path is pinned to
-- empty and every object is schema-qualified (Supabase hardening guidance).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  insert into public.usage_metering (user_id, period_start, period_end, plan_limit_tokens)
  values (
    new.id,
    now(),
    now() + interval '1 month',
    100000  -- free-tier monthly token allowance
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
