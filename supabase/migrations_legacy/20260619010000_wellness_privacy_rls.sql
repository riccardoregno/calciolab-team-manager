-- Fix privacy: i giocatori non devono poter leggere il wellness dei compagni.
-- Sostituisce la policy SELECT che permetteva a qualsiasi membro del team di leggere tutto.

DROP POLICY IF EXISTS "team_members_read_wellness" ON player_wellness;

-- Staff (non player) può leggere tutto il wellness del team
CREATE POLICY "staff_read_wellness"
  ON player_wellness FOR SELECT
  USING (
    team_id = ANY(public.get_my_team_ids())
    AND NOT EXISTS (
      SELECT 1 FROM public.player_accounts pa
      WHERE pa.auth_user_id = auth.uid()
        AND pa.team_id = player_wellness.team_id
    )
  );

-- Il giocatore può leggere solo il proprio wellness
CREATE POLICY "player_read_own_wellness"
  ON player_wellness FOR SELECT
  USING (
    player_id::text IN (
      SELECT pa.player_id FROM public.player_accounts pa
      WHERE pa.auth_user_id = auth.uid()
        AND pa.team_id = player_wellness.team_id
    )
  );
