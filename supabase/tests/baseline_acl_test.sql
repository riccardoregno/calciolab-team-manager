\set ON_ERROR_STOP on

-- Run with psql against the disposable local PostgreSQL 17 cluster.
-- This check reads catalogs only and requires no seed or credentials in SQL.
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;

DO $acl$
DECLARE
  mismatch text;
BEGIN
  WITH functions(signature) AS (VALUES
    ('public.can_manage_team_area(uuid,text)'::regprocedure),
    ('public.create_team_season(uuid,uuid,text,date,date,uuid,uuid[])'::regprocedure),
    ('public.get_my_team_ids()'::regprocedure),
    ('public.increment_player_stats(uuid,text,text,integer,integer,integer,integer,integer,boolean)'::regprocedure),
    ('public.is_latest_team_season(uuid,uuid)'::regprocedure),
    ('public.prevent_unauthorized_set_plays_update()'::regprocedure)
  )
  SELECT f.signature::text INTO mismatch
  FROM functions AS f
  JOIN pg_proc AS p ON p.oid = f.signature
  WHERE has_function_privilege('anon', p.oid, 'EXECUTE')
    OR NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
    OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
    OR EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
    )
  ORDER BY f.signature::text
  LIMIT 1;

  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'Function EXECUTE differs from the snapshot for %', mismatch;
  END IF;

  WITH tables(relation, authenticated_privileges) AS (VALUES
    ('public.team_seasons'::regclass, ARRAY['SELECT']),
    ('public.team_season_players'::regclass, ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
  ),
  roles(role_name) AS (VALUES ('anon'::name), ('authenticated'::name)),
  privileges(privilege_name) AS (VALUES
    ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
    ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
  )
  SELECT format('%s / %s / %s', t.relation, r.role_name, p.privilege_name) INTO mismatch
  FROM tables AS t
  CROSS JOIN roles AS r
  CROSS JOIN privileges AS p
  WHERE has_table_privilege(r.role_name, t.relation, p.privilege_name)
    IS DISTINCT FROM (r.role_name = 'authenticated' AND p.privilege_name = ANY (t.authenticated_privileges))
    OR has_table_privilege(r.role_name, t.relation, p.privilege_name || ' WITH GRANT OPTION')
  ORDER BY t.relation::text, r.role_name, p.privilege_name
  LIMIT 1;

  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'Table privilege differs from the snapshot for %', mismatch;
  END IF;
END;
$acl$;

ROLLBACK;
\echo CALCIOLAB_BASELINE_ACL_TEST: PASS
