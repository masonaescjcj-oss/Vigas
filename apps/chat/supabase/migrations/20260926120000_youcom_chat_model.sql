-- ---------------------------------------------------------------------------
-- You.com Express in the model catalogue.
--
-- Chat's default engine when a You.com key is configured: it searches the web
-- and cites what it found. Chat-only — it has no function calling, so Build
-- never offers it (the app filters it out, and the server maps it to the
-- default model if an older app asks Build for it anyway).
--
-- Not is_default: that flag marks Build's default, which stays an
-- OpenAI-compatible model. Chat reaches You.com through "Auto".
-- ---------------------------------------------------------------------------
insert into public.models (id, display_name, description, tone, icon, is_default, is_active, sort_order)
values ('youcom-express', 'You.com Express', 'Searches the web · Chat only', 'brandPrimary', 'globe', false, true, -1)
on conflict (id) do update set
  display_name = excluded.display_name,
  description  = excluded.description,
  icon         = excluded.icon,
  is_active    = true,
  sort_order   = excluded.sort_order,
  updated_at   = now();
