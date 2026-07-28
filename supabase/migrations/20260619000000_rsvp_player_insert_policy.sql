-- Consente ai giocatori di inserire la propria risposta RSVP anche se il coach
-- non ha ancora generato il token (upsert dal portal giocatore).
-- La policy UPDATE esiste già in 20260616120000_player_portal_rls.sql.

DROP POLICY IF EXISTS "rsvp_tokens_insert_own_player" ON public.rsvp_tokens;

CREATE POLICY "rsvp_tokens_insert_own_player"
  ON public.rsvp_tokens
  FOR INSERT
  WITH CHECK (
    player_id = (
      SELECT pa.player_id
      FROM   public.player_accounts pa
      WHERE  pa.auth_user_id = auth.uid()
        AND  pa.team_id      = rsvp_tokens.team_id
      LIMIT 1
    )
    AND response IN ('yes', 'no')
  );
