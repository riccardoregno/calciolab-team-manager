-- =============================================================================
-- CalcioLab — enforce staff customAreas for client-side writes
--
-- UI RoleGate/PermissionProvider already hides write actions for customAreas
-- set to "view" or "none". This migration mirrors that intent in RLS for the
-- synced entity tables, so a staff member cannot bypass the UI with direct
-- Supabase client calls.
--
-- Conservative rollout:
--   - owner/headCoach can always manage.
--   - explicit customAreas[area] = "view" or "none" blocks writes.
--   - explicit "manage", missing member JSON, or "role" preserve legacy access.
-- =============================================================================

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

  IF v_role IN ('owner', 'headCoach') THEN
    RETURN true;
  END IF;

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
GRANT EXECUTE ON FUNCTION public.can_manage_team_area(uuid, text) TO authenticated;


-- ─── Entity table write policies ─────────────────────────────────────────────

DO $$
DECLARE
  entry record;
BEGIN
  FOR entry IN
    SELECT *
    FROM (
      VALUES
        ('players',         'players'),
        ('exercises',       'exercises'),
        ('sessions',        'sessions'),
        ('matches',         'matches'),
        ('physical_tests',  'physical'),
        ('gps_sessions',    'physical'),
        ('staff_tasks',     'staffTasks'),
        ('injury_records',  'availability'),
        ('player_injuries', 'availability'),
        ('player_stats',    'matches'),
        ('player_matches',  'matches')
    ) AS v(table_name, area_key)
  LOOP
    IF to_regclass(format('public.%I', entry.table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', entry.table_name);

      EXECUTE format(
        'DROP POLICY IF EXISTS "team_iso_insert_%s" ON public.%I',
        entry.table_name,
        entry.table_name
      );
      EXECUTE format(
        'DROP POLICY IF EXISTS "team_area_insert_%s" ON public.%I',
        entry.table_name,
        entry.table_name
      );
      EXECUTE format(
        'CREATE POLICY "team_area_insert_%s" ON public.%I FOR INSERT WITH CHECK (public.can_manage_team_area(team_id, %L))',
        entry.table_name,
        entry.table_name,
        entry.area_key
      );

      EXECUTE format(
        'DROP POLICY IF EXISTS "team_iso_update_%s" ON public.%I',
        entry.table_name,
        entry.table_name
      );
      EXECUTE format(
        'DROP POLICY IF EXISTS "team_area_update_%s" ON public.%I',
        entry.table_name,
        entry.table_name
      );
      EXECUTE format(
        'CREATE POLICY "team_area_update_%s" ON public.%I FOR UPDATE USING (public.can_manage_team_area(team_id, %L)) WITH CHECK (public.can_manage_team_area(team_id, %L))',
        entry.table_name,
        entry.table_name,
        entry.area_key,
        entry.area_key
      );

      EXECUTE format(
        'DROP POLICY IF EXISTS "team_iso_delete_%s" ON public.%I',
        entry.table_name,
        entry.table_name
      );
      EXECUTE format(
        'DROP POLICY IF EXISTS "team_area_delete_%s" ON public.%I',
        entry.table_name,
        entry.table_name
      );
      EXECUTE format(
        'CREATE POLICY "team_area_delete_%s" ON public.%I FOR DELETE USING (public.can_manage_team_area(team_id, %L))',
        entry.table_name,
        entry.table_name,
        entry.area_key
      );
    END IF;
  END LOOP;
END $$;


-- player_stats/player_matches were originally created with a FOR ALL policy.
-- Split it so SELECT remains team-wide while writes honor customAreas.
DO $$
DECLARE
  entry record;
BEGIN
  FOR entry IN
    SELECT * FROM (VALUES ('player_stats'), ('player_matches'), ('player_injuries')) AS v(table_name)
  LOOP
    IF to_regclass(format('public.%I', entry.table_name)) IS NOT NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS "team_iso_all_%s" ON public.%I',
        entry.table_name,
        entry.table_name
      );
      EXECUTE format(
        'DROP POLICY IF EXISTS "team_iso_select_%s" ON public.%I',
        entry.table_name,
        entry.table_name
      );
      EXECUTE format(
        'CREATE POLICY "team_iso_select_%s" ON public.%I FOR SELECT USING (team_id = ANY(public.get_my_team_ids()))',
        entry.table_name,
        entry.table_name
      );
    END IF;
  END LOOP;
END $$;


-- ─── RPC write path ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_player_stats(
  p_team_id          uuid,
  p_player_id        text,
  p_season           text,
  p_delta_goals      int  DEFAULT 0,
  p_delta_assists    int  DEFAULT 0,
  p_delta_minutes    int  DEFAULT 0,
  p_delta_yellow     int  DEFAULT 0,
  p_delta_red        int  DEFAULT 0,
  p_new_appearance   bool DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_team_area(p_team_id, 'matches') THEN
    RAISE EXCEPTION
      'access_denied: user % cannot manage match stats for team %',
      auth.uid(), p_team_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.player_stats
    (team_id, player_id, season, goals, assists, minutes_played,
     yellow_cards, red_cards, appearances, updated_at)
  VALUES
    (p_team_id, p_player_id, p_season,
     GREATEST(0, p_delta_goals),
     GREATEST(0, p_delta_assists),
     GREATEST(0, p_delta_minutes),
     GREATEST(0, p_delta_yellow),
     GREATEST(0, p_delta_red),
     CASE WHEN p_new_appearance THEN 1 ELSE 0 END,
     now())
  ON CONFLICT (team_id, player_id, season) DO UPDATE SET
    goals          = GREATEST(0, public.player_stats.goals          + p_delta_goals),
    assists        = GREATEST(0, public.player_stats.assists        + p_delta_assists),
    minutes_played = GREATEST(0, public.player_stats.minutes_played + p_delta_minutes),
    yellow_cards   = GREATEST(0, public.player_stats.yellow_cards   + p_delta_yellow),
    red_cards      = GREATEST(0, public.player_stats.red_cards      + p_delta_red),
    appearances    = public.player_stats.appearances + CASE WHEN p_new_appearance THEN 1 ELSE 0 END,
    updated_at     = now();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_player_stats(uuid, text, text, int, int, int, int, int, bool) FROM anon;
REVOKE ALL ON FUNCTION public.increment_player_stats(uuid, text, text, int, int, int, int, int, bool) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_player_stats(uuid, text, text, int, int, int, int, int, bool) TO authenticated;


-- ─── Staff chat and player portal write policies ─────────────────────────────

DROP POLICY IF EXISTS "staff_messages_insert" ON public.staff_messages;
CREATE POLICY "staff_messages_insert"
  ON public.staff_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_manage_team_area(team_id, 'staffChat')
  );

DROP POLICY IF EXISTS "staff_messages_delete_own" ON public.staff_messages;
CREATE POLICY "staff_messages_delete_own"
  ON public.staff_messages
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND public.can_manage_team_area(team_id, 'staffChat')
  );

DROP POLICY IF EXISTS "player_accounts_delete_team_staff" ON public.player_accounts;
CREATE POLICY "player_accounts_delete_team_staff"
  ON public.player_accounts
  FOR DELETE
  USING (public.can_manage_team_area(team_id, 'players'));
