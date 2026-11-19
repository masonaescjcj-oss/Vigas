-- Pin the trigger function's lookup path and remove direct Data API access to
-- the privileged signup trigger. Trigger execution itself remains available
-- to Supabase Auth and backend maintenance.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to supabase_auth_admin, service_role;
