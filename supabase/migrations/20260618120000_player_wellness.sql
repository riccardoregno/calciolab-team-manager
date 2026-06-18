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
  USING (can_access_team(team_id));

-- Il giocatore può inserire/aggiornare il proprio wellness
CREATE POLICY "player_upsert_own_wellness"
  ON player_wellness FOR INSERT
  WITH CHECK (
    player_id IN (
      SELECT id FROM players WHERE team_id = player_wellness.team_id
        AND id IN (SELECT player_id FROM player_accounts WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "player_update_own_wellness"
  ON player_wellness FOR UPDATE
  USING (
    player_id IN (
      SELECT id FROM players WHERE team_id = player_wellness.team_id
        AND id IN (SELECT player_id FROM player_accounts WHERE auth_user_id = auth.uid())
    )
  );
