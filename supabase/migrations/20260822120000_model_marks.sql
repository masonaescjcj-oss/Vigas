-- ---------------------------------------------------------------------------
-- Point the seeded models at the picker's own marks.
--
-- They were sharing generic glyphs — two of the three used the same one — so
-- the picker read as a list of near-identical rows. The marks in
-- components/ModelMarks.tsx describe what each model is for (fast, economical,
-- reasoning) rather than borrowing a vendor's logo: the provider is an
-- aggregator, and "GPT-5.6 Luna" and "DeepSeek V4 Flash" are not products of
-- the companies their names evoke, so a vendor mark would claim something the
-- routing does not support.
--
-- Only rows still on the seeded defaults are touched, so an operator who has
-- already chosen an icon keeps it.
-- ---------------------------------------------------------------------------

update public.models set icon = 'model-fast'
  where id = 'gpt-5.6-luna' and icon = 'zap';

update public.models set icon = 'model-economical'
  where id = 'deepseek-v4-flash' and icon = 'code';

update public.models set icon = 'model-reasoning'
  where id = 'deepseek-reasoner' and icon = 'sparkles';
