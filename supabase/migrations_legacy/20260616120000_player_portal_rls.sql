-- =============================================================================
-- CalcioLab — Player Portal RLS hardening
--
-- A1: can_manage_team_area — explicit RETURN false for role='player'.
--     Previously the legacy path (RETURN true for unconfigured customAreas)
--     applied to player accounts too, letting them write to entity tables.
--
-- A2: rsvp_tokens — allow authenticated players to update their own RSVP
--     response directly (no TTL, no public link required).
-- =============================================================================

-- ─── A1: block player role from entity-table writes ──────────────────────────

CREATE OR REPLACE FUNCTION public.can_manage_team_area(
  p_team_id uuid,
  p_area text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_area_access text;
  v_member_id text;
BEGIN
  IF auth.uid() IS NULL OR p_team_id IS NULL OR p_area IS NULL THEN
    RETURN false;
  END IF;

  SELECT tm.role
  INTO v_role
  FROM public.team_members tm
  WHERE tm.team_id = p_team_id
    AND tm.user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- owner/headCoach always have full write access
  IF v_role IN ('owner', 'headCoach') THEN
    RETURN true;
  END IF;

  -- player accounts must never write to staff entity tables
  IF v_role = 'player' THEN
    RETURN false;
  END IF;

  -- For other staff roles, check customAreas configuration
  v_member_id := 'member-' || auth.uid()::text;

  SELECT member_item->'customAreas'->>p_area
  INTO v_area_access
  FROM public.teams t
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(t.settings->'members') = 'array'
      THEN t.settings->'members'
      ELSE '[]'::jsonb
    END
  ) AS member_item
  WHERE t.id = p_team_id
    AND member_item->>'id' = v_member_id
  LIMIT 1;

  IF v_area_access IN ('view', 'none') THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_team_area(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_team_area(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_manage_team_area(uuid, text) TO authenticated;


-- ─── A2: player can update their own RSVP response ───────────────────────────

DROP POLICY IF EXISTS "rsvp_tokens_update_own_player" ON public.rsvp_tokens;

CREATE POLICY "rsvp_tokens_update_own_player"
  ON public.rsvp_tokens
  FOR UPDATE
  USING (
    player_id = (
      SELECT pa.player_id
      FROM   public.player_accounts pa
      WHERE  pa.auth_user_id = auth.uid()
        AND  pa.team_id      = rsvp_tokens.team_id
      LIMIT 1
    )
  )
  WITH CHECK (
    player_id = (
      SELECT pa.player_id
      FROM   public.player_accounts pa
      WHERE  pa.auth_user_id = auth.uid()
        AND  pa.team_id      = rsvp_tokens.team_id
      LIMIT 1
    )
  );
