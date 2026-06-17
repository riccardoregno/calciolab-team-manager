-- =============================================================================
-- CalcioLab - Player portal activity
--
-- Tracks how often a linked player opens the portal and the last heartbeat.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.player_portal_activity (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id    TEXT        NOT NULL,
  auth_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_count  INTEGER     NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ,
  online_until  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS player_portal_activity_team_player_idx
  ON public.player_portal_activity(team_id, player_id);

CREATE UNIQUE INDEX IF NOT EXISTS player_portal_activity_team_auth_user_idx
  ON public.player_portal_activity(team_id, auth_user_id);

CREATE INDEX IF NOT EXISTS player_portal_activity_online_idx
  ON public.player_portal_activity(team_id, online_until);

ALTER TABLE public.player_portal_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppa_select_team_or_own_player" ON public.player_portal_activity;
CREATE POLICY "ppa_select_team_or_own_player"
  ON public.player_portal_activity
  FOR SELECT
  USING (
    team_id = ANY(public.get_my_team_ids())
    OR auth_user_id = auth.uid()
  );

-- Writes are intentionally routed through the RPC below, so players can only
-- touch their own linked portal activity row.
CREATE OR REPLACE FUNCTION public.touch_player_portal_activity(
  p_team_id UUID,
  p_player_id TEXT,
  p_increment BOOLEAN DEFAULT false
)
RETURNS public.player_portal_activity
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.player_portal_activity;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.player_accounts pa
    WHERE pa.auth_user_id = auth.uid()
      AND pa.team_id = p_team_id
      AND pa.player_id = p_player_id
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  INSERT INTO public.player_portal_activity (
    team_id,
    player_id,
    auth_user_id,
    visit_count,
    first_seen_at,
    last_seen_at,
    online_until,
    updated_at
  )
  VALUES (
    p_team_id,
    p_player_id,
    auth.uid(),
    CASE WHEN p_increment THEN 1 ELSE 0 END,
    now(),
    now(),
    now() + interval '2 minutes',
    now()
  )
  ON CONFLICT (team_id, player_id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    visit_count = public.player_portal_activity.visit_count + CASE WHEN p_increment THEN 1 ELSE 0 END,
    last_seen_at = now(),
    online_until = now() + interval '2 minutes',
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_player_portal_activity(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_player_portal_activity(UUID, TEXT, BOOLEAN) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'player_portal_activity'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE player_portal_activity;
  END IF;
END $$;
