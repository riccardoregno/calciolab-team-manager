-- =============================================================================
-- CalcioLab — Player portal accounts (link auth.users -> roster player)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.player_accounts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id      UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id    TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS player_accounts_team_player_idx
  ON public.player_accounts(team_id, player_id);

ALTER TABLE public.player_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_accounts_select_own" ON public.player_accounts;
CREATE POLICY "player_accounts_select_own"
  ON public.player_accounts
  FOR SELECT
  USING (auth_user_id = auth.uid() OR team_id = ANY(public.get_my_team_ids()));

DROP POLICY IF EXISTS "player_accounts_delete_team_staff" ON public.player_accounts;
CREATE POLICY "player_accounts_delete_team_staff"
  ON public.player_accounts
  FOR DELETE
  USING (team_id = ANY(public.get_my_team_ids()));

-- Inserts/updates are intentionally blocked for normal clients.
-- The accept-team-invite Edge Function uses the service role to create rows.
-- Staff can revoke a player's portal access directly (DELETE policy above).
