-- =============================================================================
-- CalcioLab — enforce customAreas.setPlays on teams.set_plays writes
--
-- setPlays is stored as a JSONB column on teams instead of a dedicated
-- team_id-scoped table. RLS cannot express per-column update rules, so this
-- trigger blocks client-side changes to set_plays unless the caller can manage
-- the setPlays area. Service-role calls keep working because auth.uid() is null.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_set_plays_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.set_plays IS DISTINCT FROM OLD.set_plays
     AND auth.uid() IS NOT NULL
     AND NOT public.can_manage_team_area(OLD.id, 'setPlays') THEN
    RAISE EXCEPTION
      'set_plays_forbidden: user % cannot manage set plays for team %',
      auth.uid(), OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teams_set_plays_write_permission ON public.teams;
CREATE TRIGGER teams_set_plays_write_permission
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_set_plays_update();

REVOKE ALL ON FUNCTION public.prevent_unauthorized_set_plays_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_unauthorized_set_plays_update() FROM anon;
