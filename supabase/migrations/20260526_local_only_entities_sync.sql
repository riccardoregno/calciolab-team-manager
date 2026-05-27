-- =============================================================================
-- CalcioLab — Sync local-only entities to Supabase
-- Tabelle: gps_sessions, staff_tasks, injury_records
-- Colonna: teams.set_plays (JSONB, single-object per team)
--
-- APPLY: Supabase Dashboard > SQL Editor
-- =============================================================================

-- ─── 1. gps_sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gps_sessions (
  id         TEXT        PRIMARY KEY,
  team_id    UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data       JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gps_sessions_team_id_idx ON public.gps_sessions(team_id);

-- ─── 2. staff_tasks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_tasks (
  id         TEXT        PRIMARY KEY,
  team_id    UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data       JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_tasks_team_id_idx ON public.staff_tasks(team_id);

-- ─── 3. injury_records ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.injury_records (
  id         TEXT        PRIMARY KEY,
  team_id    UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data       JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS injury_records_team_id_idx ON public.injury_records(team_id);

-- ─── 4. set_plays colonna su teams ────────────────────────────────────────────
-- setPlays è un oggetto singolo per team (non un array), viene salvato come
-- colonna JSONB direttamente sulla riga teams, simile a `settings`.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS set_plays JSONB DEFAULT '{}';


-- ─── 5. RLS per le 3 nuove tabelle ────────────────────────────────────────────
-- Usa get_my_team_ids() (uuid[]) già esistente — evita subquery inline ripetute.
-- Sintassi: team_id = ANY(get_my_team_ids()) per array uuid[].

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['gps_sessions', 'staff_tasks', 'injury_records']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- SELECT
    EXECUTE format($fmt$
      DROP POLICY IF EXISTS "team_iso_select_%s" ON %I;
      CREATE POLICY "team_iso_select_%s" ON %I FOR SELECT
        USING (team_id = ANY(public.get_my_team_ids()))
    $fmt$, t, t, t, t);

    -- INSERT
    EXECUTE format($fmt$
      DROP POLICY IF EXISTS "team_iso_insert_%s" ON %I;
      CREATE POLICY "team_iso_insert_%s" ON %I FOR INSERT
        WITH CHECK (team_id = ANY(public.get_my_team_ids()))
    $fmt$, t, t, t, t);

    -- UPDATE
    EXECUTE format($fmt$
      DROP POLICY IF EXISTS "team_iso_update_%s" ON %I;
      CREATE POLICY "team_iso_update_%s" ON %I FOR UPDATE
        USING     (team_id = ANY(public.get_my_team_ids()))
        WITH CHECK(team_id = ANY(public.get_my_team_ids()))
    $fmt$, t, t, t, t);

    -- DELETE
    EXECUTE format($fmt$
      DROP POLICY IF EXISTS "team_iso_delete_%s" ON %I;
      CREATE POLICY "team_iso_delete_%s" ON %I FOR DELETE
        USING (team_id = ANY(public.get_my_team_ids()))
    $fmt$, t, t, t, t);
  END LOOP;
END $$;
