-- A client may bootstrap membership only for a team it owns.
-- Invited members are inserted by the authenticated invite Edge Function using service_role.
-- This restrictive policy also guards against older permissive INSERT policies.
CREATE POLICY "team_members_insert_owned_team_only"
  ON public.team_members
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'owner'
    AND EXISTS (
      SELECT 1
      FROM public.teams AS owned_team
      WHERE owned_team.id = team_members.team_id
        AND owned_team.owner_id = (SELECT auth.uid())
    )
  );
