-- player_wellness: daily wellness check-in per giocatore
CREATE TABLE IF NOT EXISTS player_wellness (
  id         uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id    uuid    NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id  uuid    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  date       date    NOT NULL,
  sleep      smallint CHECK (sleep BETWEEN 1 AND 5),
  fatigue    smallint CHECK (fatigue BETWEEN 1 AND 5),
  mood       smallint CHECK (mood BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_id, player_id, date)
);

ALTER TABLE player_wellness ENABLE ROW LEVEL SECURITY;

-- Coach/staff può leggere tutto il wellness del proprio team
CREATE POLICY "team_members_read_wellness"
  ON player_wellness FOR SELECT
  USING (team_id = ANY(public.get_my_team_ids()));

-- Il giocatore può inserire il proprio wellness
CREATE POLICY "player_insert_own_wellness"
  ON player_wellness FOR INSERT
  WITH CHECK (
    team_id = ANY(public.get_my_team_ids())
    AND player_id::text IN (
      SELECT player_id FROM public.player_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- Il giocatore può aggiornare il proprio wellness
CREATE POLICY "player_update_own_wellness"
  ON player_wellness FOR UPDATE
  USING (
    team_id = ANY(public.get_my_team_ids())
    AND player_id::text IN (
      SELECT player_id FROM public.player_accounts WHERE auth_user_id = auth.uid()
    )
  );
