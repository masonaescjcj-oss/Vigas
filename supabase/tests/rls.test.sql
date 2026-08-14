-- tests/rls.test.sql
-- pgTAP tests proving multi-tenant isolation: no user can read or write another
-- user's data through any table. Run with:
--
--   supabase test db            # (uses pg_prove under the hood)
--   -- or --
--   pg_prove -d "$DATABASE_URL" supabase/tests/rls.test.sql
--
-- The test seeds two users as superuser (RLS bypassed), then switches to the
-- `authenticated` role and sets the JWT `sub` claim to impersonate each user so
-- that RLS is actually enforced.

begin;

create extension if not exists pgtap;

-- pgTAP assertions must be callable by the `authenticated` role we switch into.
-- (If pgtap is installed in a schema other than public, grant execute there too.)
grant usage on schema public to authenticated;
grant execute on all functions in schema public to authenticated;

select plan(15);

-- ---------------------------------------------------------------------------
-- Fixtures (seeded as the test superuser; RLS does not apply here).
-- Inserting into auth.users fires handle_new_user(), which creates the matching
-- profiles and usage_metering rows automatically.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'a@test.dev', '{}'::jsonb, '{"full_name":"User A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'b@test.dev', '{}'::jsonb, '{"full_name":"User B"}'::jsonb, now(), now());

insert into public.projects (id, user_id, name, sandbox_path) values
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'A project', '/sandbox/a'),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'B project', '/sandbox/b');

insert into public.agent_sessions (id, project_id, user_id) values
  ('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222');

insert into public.agent_tasks (id, session_id, tool_name) values
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444441', 'write'),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444442', 'write');

insert into public.checkpoints (id, project_id, snapshot_path) values
  ('66666666-6666-6666-6666-666666666661', '33333333-3333-3333-3333-333333333331', '/snap/a'),
  ('66666666-6666-6666-6666-666666666662', '33333333-3333-3333-3333-333333333332', '/snap/b');

insert into public.subscriptions (user_id, plan_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'pro', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'pro', 'active');

-- ---------------------------------------------------------------------------
-- Become User A (RLS now enforced).
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Positive controls: A sees its own data.
select is((select count(*)::int from public.projects       where id = '33333333-3333-3333-3333-333333333331'), 1, 'A can see its own project');
select is((select count(*)::int from public.agent_sessions where id = '44444444-4444-4444-4444-444444444441'), 1, 'A can see its own session');
select is((select count(*)::int from public.agent_tasks    where id = '55555555-5555-5555-5555-555555555551'), 1, 'A can see its own task');

-- Isolation: A cannot see any of B's data.
select is((select count(*)::int from public.projects       where id      = '33333333-3333-3333-3333-333333333332'), 0, 'A cannot see B project');
select is((select count(*)::int from public.agent_sessions where id      = '44444444-4444-4444-4444-444444444442'), 0, 'A cannot see B session');
select is((select count(*)::int from public.agent_tasks    where id      = '55555555-5555-5555-5555-555555555552'), 0, 'A cannot see B task');
select is((select count(*)::int from public.checkpoints    where id      = '66666666-6666-6666-6666-666666666662'), 0, 'A cannot see B checkpoint');
select is((select count(*)::int from public.subscriptions  where user_id = '22222222-2222-2222-2222-222222222222'), 0, 'A cannot see B subscription');
select is((select count(*)::int from public.usage_metering where user_id = '22222222-2222-2222-2222-222222222222'), 0, 'A cannot see B usage_metering');

-- Isolation: A cannot mutate B's rows (RLS filters them → 0 affected).
select is((with u as (update public.projects set name = 'hacked' where id = '33333333-3333-3333-3333-333333333332' returning 1) select count(*)::int from u), 0, 'A cannot update B project');
select is((with d as (delete from public.projects where id = '33333333-3333-3333-3333-333333333332' returning 1) select count(*)::int from d), 0, 'A cannot delete B project');
select is((with u as (update public.subscriptions set status = 'canceled' where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u), 0, 'A cannot update B subscription');

-- A cannot forge a project owned by B (WITH CHECK violation → 42501).
select throws_ok(
  $$ insert into public.projects (user_id, name, sandbox_path) values ('22222222-2222-2222-2222-222222222222', 'forged', '/x') $$,
  '42501', NULL, 'A cannot insert a project owned by B'
);

-- Sensitive tables are not client-writable (no authenticated INSERT policy → 42501).
select throws_ok(
  $$ insert into public.subscriptions (user_id, plan_id, status) values ('11111111-1111-1111-1111-111111111111', 'pro', 'active') $$,
  '42501', NULL, 'client cannot insert into subscriptions (service_role only)'
);
select throws_ok(
  $$ insert into public.checkpoints (project_id, snapshot_path) values ('33333333-3333-3333-3333-333333333331', '/snap/x') $$,
  '42501', NULL, 'client cannot insert into checkpoints (service_role only)'
);

reset role;
select * from finish();
rollback;
