-- 20260816150000_shared_apps.sql
-- ---------------------------------------------------------------------------
-- Sharing what you built.
--
-- Someone builds something on their phone and currently cannot show it to
-- anyone. This is the growth loop the app is missing: one tap gives a public
-- URL you can send to a friend.
--
-- The document is served straight from a public Storage bucket, so there is no
-- server to run and no hosting account to sign up for. The row here is the
-- record: who owns it, which project it came from, and whether it has been
-- taken down.
-- ---------------------------------------------------------------------------

-- Deliberately PRIVATE, which is the opposite of what this migration first said.
-- Supabase Storage serves text/html as text/plain in a public bucket -- measured,
-- and deliberate on their side, so that *.supabase.co cannot host arbitrary
-- pages. A direct object URL would have shown someone's app as its own source
-- code. The share-page edge function reads the object with the service key and
-- returns it with the right content type, so nothing needs public access here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-apps', 'shared-apps', false, 2000000, array['text/html'])
on conflict (id) do update set
  public = false,
  file_size_limit = 2000000,
  allowed_mime_types = array['text/html'];

create table if not exists public.shares (
  -- A short URL-safe code, not a uuid: this ends up in a link someone types
  -- or reads aloud.
  code         text primary key,
  project_id   uuid not null references public.projects (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  title        text,
  -- Bytes of the published document, so the operator can see what is stored.
  size_bytes   integer not null default 0,
  -- Set when the owner takes it down. The row is kept so the code is never
  -- reissued to someone else.
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.shares is
  'Published snapshots of a project, served from the public shared-apps bucket.';

create index if not exists idx_shares_user on public.shares (user_id, created_at desc);
create index if not exists idx_shares_project on public.shares (project_id);

alter table public.shares enable row level security;

-- The owner may see their own shares. Nobody needs to read anyone else's row:
-- the published document is public, but who published it is not.
drop policy if exists "shares_owner_read" on public.shares;
create policy "shares_owner_read" on public.shares
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "shares_service_role" on public.shares;
create policy "shares_service_role" on public.shares
  for all to service_role using (true) with check (true);

grant select on public.shares to authenticated;

drop trigger if exists shares_updated_at on public.shares;
create trigger shares_updated_at before update on public.shares
  for each row execute function public.touch_updated_at();
