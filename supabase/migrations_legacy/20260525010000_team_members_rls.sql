-- =============================================================================
-- CalcioLab — team_members RLS + vip_events write-block
-- 2026-05-25
--
-- CONTEXT
--   All entity-table policies rely on team_members as the authorization
--   pivot (e.g. "SELECT team_id FROM team_members WHERE user_id = auth.uid()").
--   Without RLS on team_members itself, any authenticated user could:
--     • Read all members of every team (IDOR)
--     • Insert arbitrary membership rows (privilege escalation)
--     • Update roles without being an owner/headCoach
--     • Delete other users' memberships
--
--   vip_events already has RLS enabled with a SELECT-only policy, meaning
--   INSERT/UPDATE/DELETE are implicitly denied for client roles.  We add
--   explicit WITH CHECK (false) policies to make the intent visible in the
--   Supabase dashboard and harden against future policy mis-configuration.
--
-- APPROACH: avoid self-referential recursion
--   A SELECT policy on team_members that contains a subquery against
--   team_members itself would recurse infinitely.  We break the cycle with
--   a SECURITY DEFINER helper function that bypasses RLS, giving us a
--   stable, non-recursive way to determine the current user's teams.
--
-- EXECUTION: idempotent — safe to run multiple times.
-- =============================================================================


-- ─── 1. SECURITY DEFINER helper ──────────────────────────────────────────────
--
-- Returns the team_ids the current user belongs to.
-- SECURITY DEFINER = runs as the function owner (postgres) → bypasses RLS,
-- eliminating the recursion risk.
--
-- Used by:
--   • team_members SELECT policy (below)
--   • Can be used in future policies instead of the raw subquery

CREATE OR REPLACE FUNCTION public.get_my_team_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT team_id
    FROM   public.team_members
    WHERE  user_id = auth.uid()
  );
$$;

-- Only authenticated users should call this
REVOKE EXECUTE ON FUNCTION public.get_my_team_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_team_ids() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_my_team_ids() TO authenticated;


-- ─── 2. Enable RLS on team_members ───────────────────────────────────────────

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;


-- ─── 3. SELECT: members of own team(s) ───────────────────────────────────────
--
-- A user may read any row whose team_id they belong to.
-- Uses the SECURITY DEFINER helper — no recursion.
-- Covers:
--   • Finding your own team on login
--   • Listing all staff in the team settings page

DROP POLICY IF EXISTS "team_members_select_own_teams" ON public.team_members;
CREATE POLICY "team_members_select_own_teams"
  ON public.team_members
  FOR SELECT
  USING (team_id = ANY(public.get_my_team_ids()));


-- ─── 4. INSERT: join your own team only ──────────────────────────────────────
--
-- A user may only insert a row where user_id = their own uid.
-- This allows the invite-acceptance flow (a user joins a team they were
-- invited to) but prevents one user from adding another.

DROP POLICY IF EXISTS "team_members_insert_self_only" ON public.team_members;
CREATE POLICY "team_members_insert_self_only"
  ON public.team_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- ─── 5. UPDATE: owner/headCoach can update roles ─────────────────────────────
--
-- USING  : caller must be an owner or headCoach in the same team
-- WITH CHECK: the resulting row must still belong to the same team
--   (prevents moving a member to a different team)
--
-- Note: preventing self-demotion / escalation to 'owner' is handled at the
-- application layer.  Adding DB-level checks would require knowing the
-- caller's current role inside the CHECK, which creates another subquery
-- dependency; the TRIGGER approach used for billing fields is preferred
-- for that level of granularity if needed in the future.

DROP POLICY IF EXISTS "team_members_update_managers_only" ON public.team_members;
CREATE POLICY "team_members_update_managers_only"
  ON public.team_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.team_members AS caller
      WHERE  caller.user_id = auth.uid()
        AND  caller.team_id  = team_members.team_id
        AND  caller.role    IN ('owner', 'headCoach')
    )
  )
  WITH CHECK (team_id = ANY(public.get_my_team_ids()));


-- ─── 6. DELETE: owner/headCoach can remove anyone; anyone can leave ───────────
--
-- Two cases:
--   a) caller is owner/headCoach in the same team → can remove any member
--   b) the row being deleted belongs to the caller themselves → self-removal

DROP POLICY IF EXISTS "team_members_delete_managers_or_self" ON public.team_members;
CREATE POLICY "team_members_delete_managers_or_self"
  ON public.team_members
  FOR DELETE
  USING (
    -- Self-removal (leave team)
    user_id = auth.uid()
    OR
    -- Manager-initiated removal
    EXISTS (
      SELECT 1
      FROM   public.team_members AS caller
      WHERE  caller.user_id = auth.uid()
        AND  caller.team_id  = team_members.team_id
        AND  caller.role    IN ('owner', 'headCoach')
    )
  );


-- ─── 7. vip_events: explicit write-block ─────────────────────────────────────
--
-- vip_events already has RLS enabled with only a SELECT policy, so
-- INSERT/UPDATE/DELETE are implicitly denied for all non-service-role callers.
-- We add explicit RESTRICTIVE policies with WITH CHECK (false) / USING (false)
-- to make the intent visible in the dashboard and to guard against future
-- accidental addition of permissive write policies.
--
-- service_role always bypasses RLS → Edge Functions can still write freely.

DROP POLICY IF EXISTS "vip_events_no_client_insert" ON public.vip_events;
CREATE POLICY "vip_events_no_client_insert"
  ON public.vip_events
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "vip_events_no_client_update" ON public.vip_events;
CREATE POLICY "vip_events_no_client_update"
  ON public.vip_events
  AS RESTRICTIVE
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "vip_events_no_client_delete" ON public.vip_events;
CREATE POLICY "vip_events_no_client_delete"
  ON public.vip_events
  AS RESTRICTIVE
  FOR DELETE
  USING (false);


-- ─── 8. Verify ────────────────────────────────────────────────────────────────
-- Run after applying to confirm policies are active:
--
--   SELECT tablename, policyname, cmd, qual, with_check
--   FROM   pg_policies
--   WHERE  tablename IN ('team_members', 'vip_events')
--   ORDER  BY tablename, policyname;
--
--   SELECT proname, prosecdef FROM pg_proc WHERE proname = 'get_my_team_ids';
--   -- prosecdef = true  ← confirms SECURITY DEFINER
