\set ON_ERROR_STOP on
\if :{?calciolab_system_identifier}
\else
  \set calciolab_system_identifier ''
\endif

BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL row_security = on;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';

-- The launcher reads this identifier from pg_control inside the dedicated
-- local Docker container. The SQL session must be on that same cluster,
-- through its Unix socket. Never obtain the expected value from the SQL target.
SELECT pg_catalog.set_config('calciolab.test_system_identifier', :'calciolab_system_identifier', true) AS local_guard \gset
DO $guard$
BEGIN
  IF current_database() <> 'postgres'
     OR session_user <> 'postgres'
     OR inet_server_addr() IS NOT NULL
     OR inet_client_addr() IS NOT NULL
     OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
     OR current_setting('calciolab.test_system_identifier') !~ '^[0-9]{19,20}$' THEN
    RAISE EXCEPTION 'CalcioLab RLS test requires the dedicated local PostgreSQL 17 Unix socket';
  END IF;

  IF current_setting('calciolab.test_system_identifier')
      IS DISTINCT FROM (SELECT system_identifier::text FROM pg_control_system()) THEN
    RAISE EXCEPTION 'CalcioLab RLS test: local cluster identifier mismatch';
  END IF;
END;
$guard$;

-- Auth identities have no password or provider identity. The Auth trigger
-- creates fixture profiles in this transaction. owner_id stays NULL so
-- the owner fallback cannot grant access independently of membership.
INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('ca1c10ab-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-baseline-a@example.invalid', '{}', '{}'),
  ('ca1c10ab-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-baseline-b@example.invalid', '{}', '{}');

INSERT INTO public.teams (id, name)
VALUES
  ('ca1c10ab-0000-4000-8000-000000000011', 'RLS TEST TEAM A'),
  ('ca1c10ab-0000-4000-8000-000000000012', 'RLS TEST TEAM B');

INSERT INTO public.team_members (id, user_id, team_id, role)
VALUES
  ('ca1c10ab-0000-4000-8000-000000000021', 'ca1c10ab-0000-4000-8000-000000000001', 'ca1c10ab-0000-4000-8000-000000000011', 'headCoach'),
  ('ca1c10ab-0000-4000-8000-000000000022', 'ca1c10ab-0000-4000-8000-000000000002', 'ca1c10ab-0000-4000-8000-000000000012', 'headCoach');

INSERT INTO public.matches (id, team_id, data)
VALUES
  ('ca1c10ab-0000-4000-8000-000000000031', 'ca1c10ab-0000-4000-8000-000000000011', '{"fixture":true}'),
  ('ca1c10ab-0000-4000-8000-000000000032', 'ca1c10ab-0000-4000-8000-000000000012', '{"fixture":true}');

INSERT INTO public.sessions (id, team_id, data)
VALUES
  ('ca1c10ab-0000-4000-8000-000000000041', 'ca1c10ab-0000-4000-8000-000000000011', '{"fixture":true}'),
  ('ca1c10ab-0000-4000-8000-000000000042', 'ca1c10ab-0000-4000-8000-000000000012', '{"fixture":true}');

-- PostgREST uses the JSON claims setting. Clear individual legacy claims
-- so auth.uid() and auth.role() cannot read values from a prior session.
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claim.role" = '';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"ca1c10ab-0000-4000-8000-000000000001","role":"authenticated"}';

DO $user_a$
DECLARE
  team_a CONSTANT uuid := 'ca1c10ab-0000-4000-8000-000000000011';
  team_b CONSTANT uuid := 'ca1c10ab-0000-4000-8000-000000000012';
BEGIN
  IF current_user <> 'authenticated' OR auth.role() IS DISTINCT FROM 'authenticated'
     OR auth.uid() IS DISTINCT FROM 'ca1c10ab-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'User A: incorrect authentication context';
  END IF;
  IF NOT (row_security_active('public.teams') AND row_security_active('public.matches')
          AND row_security_active('public.sessions')) THEN
    RAISE EXCEPTION 'Authenticated: RLS not active on all tested tables';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = team_a) THEN
    RAISE EXCEPTION 'User A: own team hidden';
  END IF;
  IF EXISTS (SELECT 1 FROM public.teams WHERE id = team_b) THEN
    RAISE EXCEPTION 'User A: other team visible';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.matches WHERE team_id = team_a)
     OR NOT EXISTS (SELECT 1 FROM public.sessions WHERE team_id = team_a) THEN
    RAISE EXCEPTION 'User A: own match or session hidden';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matches WHERE team_id = team_b)
     OR EXISTS (SELECT 1 FROM public.sessions WHERE team_id = team_b) THEN
    RAISE EXCEPTION 'User A: other team match or session visible';
  END IF;
END;
$user_a$;

SET LOCAL "request.jwt.claims" = '{"sub":"ca1c10ab-0000-4000-8000-000000000002","role":"authenticated"}';
DO $user_b$
DECLARE
  team_a CONSTANT uuid := 'ca1c10ab-0000-4000-8000-000000000011';
  team_b CONSTANT uuid := 'ca1c10ab-0000-4000-8000-000000000012';
BEGIN
  IF current_user <> 'authenticated' OR auth.role() IS DISTINCT FROM 'authenticated'
     OR auth.uid() IS DISTINCT FROM 'ca1c10ab-0000-4000-8000-000000000002'::uuid THEN
    RAISE EXCEPTION 'User B: incorrect authentication context';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = team_b) THEN
    RAISE EXCEPTION 'User B: own team hidden';
  END IF;
  IF EXISTS (SELECT 1 FROM public.teams WHERE id = team_a) THEN
    RAISE EXCEPTION 'User B: other team visible';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.matches WHERE team_id = team_b)
     OR NOT EXISTS (SELECT 1 FROM public.sessions WHERE team_id = team_b) THEN
    RAISE EXCEPTION 'User B: own match or session hidden';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matches WHERE team_id = team_a)
     OR EXISTS (SELECT 1 FROM public.sessions WHERE team_id = team_a) THEN
    RAISE EXCEPTION 'User B: other team match or session visible';
  END IF;
END;
$user_b$;

-- The administrator changes only the fixture; the access check is run as A.
RESET ROLE;
DO $revoke_membership$
BEGIN
  DELETE FROM public.team_members
  WHERE id = 'ca1c10ab-0000-4000-8000-000000000021'
    AND user_id = 'ca1c10ab-0000-4000-8000-000000000001'
    AND team_id = 'ca1c10ab-0000-4000-8000-000000000011';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User A: fixture membership missing before revocation';
  END IF;
END;
$revoke_membership$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"ca1c10ab-0000-4000-8000-000000000001","role":"authenticated"}';
DO $without_membership$
DECLARE
  team_a CONSTANT uuid := 'ca1c10ab-0000-4000-8000-000000000011';
  team_b CONSTANT uuid := 'ca1c10ab-0000-4000-8000-000000000012';
BEGIN
  IF current_user <> 'authenticated' OR auth.role() IS DISTINCT FROM 'authenticated'
     OR auth.uid() IS DISTINCT FROM 'ca1c10ab-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'User A after revocation: incorrect authentication context';
  END IF;
  IF EXISTS (SELECT 1 FROM public.teams WHERE id IN (team_a, team_b)) THEN
    RAISE EXCEPTION 'Authenticated without membership: fixture team visible';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matches WHERE team_id IN (team_a, team_b))
     OR EXISTS (SELECT 1 FROM public.sessions WHERE team_id IN (team_a, team_b)) THEN
    RAISE EXCEPTION 'Authenticated without membership: fixture match or session visible';
  END IF;
END;
$without_membership$;

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{"role":"anon"}';
DO $anonymous$
DECLARE
  team_a CONSTANT uuid := 'ca1c10ab-0000-4000-8000-000000000011';
  team_b CONSTANT uuid := 'ca1c10ab-0000-4000-8000-000000000012';
BEGIN
  IF current_user <> 'anon' OR auth.role() IS DISTINCT FROM 'anon' OR auth.uid() IS NOT NULL
     OR NOT (row_security_active('public.teams') AND row_security_active('public.matches')
             AND row_security_active('public.sessions')) THEN
    RAISE EXCEPTION 'Anon: incorrect authentication or RLS context';
  END IF;

  -- A policy can invoke a helper without EXECUTE for anon. Both zero
  -- visible rows and SQLSTATE 42501 deny reads. Report which occurred.
  BEGIN
    IF EXISTS (SELECT 1 FROM public.teams WHERE id IN (team_a, team_b)) THEN
      RAISE EXCEPTION 'Anon: fixture team visible';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Anon: teams read denied by privileges (42501)';
  END;
  BEGIN
    IF EXISTS (SELECT 1 FROM public.matches WHERE team_id IN (team_a, team_b)) THEN
      RAISE EXCEPTION 'Anon: fixture match visible';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Anon: matches read denied by privileges (42501)';
  END;
  BEGIN
    IF EXISTS (SELECT 1 FROM public.sessions WHERE team_id IN (team_a, team_b)) THEN
      RAISE EXCEPTION 'Anon: fixture session visible';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Anon: sessions read denied by privileges (42501)';
  END;
END;
$anonymous$;

ROLLBACK;
\echo CALCIOLAB_RLS_BASELINE_TEST: PASS
