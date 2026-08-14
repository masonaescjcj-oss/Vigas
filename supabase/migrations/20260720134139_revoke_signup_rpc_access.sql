-- Supabase projects can have explicit default EXECUTE grants in addition to
-- PUBLIC. Remove every client-facing grant from the privileged trigger RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
