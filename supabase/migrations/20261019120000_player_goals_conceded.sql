-- NULL means not recorded. Zero is an explicitly recorded clean sheet.
ALTER TABLE public.player_matches
  ADD COLUMN IF NOT EXISTS goals_conceded integer
  CHECK (goals_conceded >= 0);

COMMENT ON COLUMN public.player_matches.goals_conceded IS
  'Individual goals conceded while playing goalkeeper; NULL when unknown, 0 for no goals conceded.';
