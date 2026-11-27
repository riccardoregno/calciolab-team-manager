-- =============================================================================
-- CalcioLab — Security Hardening Migration
-- Da applicare su Supabase Dashboard > SQL Editor PRIMA del go-live.
-- =============================================================================

-- ─── 1. FIX #3: colonna settings per appSettings multi-device ────────────────
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';


-- ─── 2. RLS — teams: lettura + update non-billing ────────────────────────────
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_can_read_own_team" ON teams;
CREATE POLICY "team_members_can_read_own_team"
  ON teams FOR SELECT
  USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- UPDATE consentito solo ai ruoli owner/headCoach, ma solo per campi non-billing.
-- I campi billing (subscription_plan, billing_status, trial_*) sono protetti
-- dal TRIGGER "teams_billing_immutable" qui sotto — più affidabile del WITH CHECK.
DROP POLICY IF EXISTS "team_members_can_update_non_billing_fields" ON teams;
CREATE POLICY "team_members_can_update_non_billing_fields"
  ON teams FOR UPDATE
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'headCoach')
    )
  );

-- INSERT: solo il proprietario crea il proprio team
DROP POLICY IF EXISTS "authenticated_can_insert_team" ON teams;
CREATE POLICY "authenticated_can_insert_team"
  ON teams FOR INSERT
  WITH CHECK (owner_id = auth.uid());


-- ─── 3. CRITICO FIX #1 (billing): trigger BEFORE UPDATE sui campi billing ────
-- PERCHÉ IL TRIGGER, non WITH CHECK:
--   WITH CHECK autoreferenziale (confrontare NEW vs OLD via subquery sulla stessa
--   tabella in RLS) ha comportamento ambiguo e può causare loop infiniti in Supabase.
--   Un BEFORE UPDATE trigger è atomico, deterministico e usa NEW/OLD nativi.
--
-- LOGICA DI SICUREZZA:
--   - auth.uid() ritorna NULL quando la chiamata viene dalla service_role key
--   - auth.uid() ritorna l'UUID utente per chiamate authenticated (client/anon)
--   - Solo la service_role (Edge Function webhook Stripe) ha auth.uid() = NULL
--   - Quindi: se billing cambia E auth.uid() NON è NULL → blocca, è un client

CREATE OR REPLACE FUNCTION prevent_client_billing_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan OR
    NEW.billing_status    IS DISTINCT FROM OLD.billing_status    OR
    NEW.trial_plan        IS DISTINCT FROM OLD.trial_plan        OR
    NEW.trial_ends_at     IS DISTINCT FROM OLD.trial_ends_at     OR
    NEW.trial_used        IS DISTINCT FROM OLD.trial_used
  ) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION
      'billing_immutable: subscription fields cannot be changed by the client (team: %)',
      OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teams_billing_immutable ON teams;
CREATE TRIGGER teams_billing_immutable
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION prevent_client_billing_update();


-- ─── 4. RLS — entity tables ───────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['players','exercises','sessions','matches','physical_tests']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format($fmt$
      DROP POLICY IF EXISTS "team_iso_select_%s" ON %I;
      CREATE POLICY "team_iso_select_%s" ON %I FOR SELECT
        USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
    $fmt$, t, t, t, t);

    EXECUTE format($fmt$
      DROP POLICY IF EXISTS "team_iso_insert_%s" ON %I;
      CREATE POLICY "team_iso_insert_%s" ON %I FOR INSERT
        WITH CHECK (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
    $fmt$, t, t, t, t);

    EXECUTE format($fmt$
      DROP POLICY IF EXISTS "team_iso_update_%s" ON %I;
      CREATE POLICY "team_iso_update_%s" ON %I FOR UPDATE
        USING     (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
        WITH CHECK(team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
    $fmt$, t, t, t, t);

    EXECUTE format($fmt$
      DROP POLICY IF EXISTS "team_iso_delete_%s" ON %I;
      CREATE POLICY "team_iso_delete_%s" ON %I FOR DELETE
        USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
    $fmt$, t, t, t, t);
  END LOOP;
END $$;


-- ─── 5. RLS — player_stats e player_matches ──────────────────────────────────
ALTER TABLE player_stats   ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_matches ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['player_stats','player_matches']
  LOOP
    EXECUTE format($fmt$
      DROP POLICY IF EXISTS "team_iso_all_%s" ON %I;
      CREATE POLICY "team_iso_all_%s" ON %I FOR ALL
        USING     (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
        WITH CHECK(team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
    $fmt$, t, t, t, t);
  END LOOP;
END $$;


-- ─── 6. CRITICO FIX #4: DB Function atomica — increment_player_stats ─────────
-- FIX rispetto alla prima versione:
--   a) SET search_path = public — previene search_path injection attacks
--   b) Membership check interno — un utente autenticato non può incrementare
--      stats di un team di cui non è membro, anche se conosce il team_id
--   c) Permessi revocati da anon, concessi solo ad authenticated

CREATE OR REPLACE FUNCTION increment_player_stats(
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
-- SET search_path previene che un attacker crei funzioni/tabelle shadow
-- in uno schema diverso per intercettare l'esecuzione
SET search_path = public
AS $$
BEGIN
  -- Membership check: solo i membri del team possono aggiornare le sue stats.
  -- Questo impedisce a un utente autenticato (ma non membro) di chiamare la
  -- funzione con un team_id arbitrario che conosce.
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION
      'access_denied: user % is not a member of team %',
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

REVOKE ALL  ON FUNCTION increment_player_stats FROM anon;
REVOKE ALL  ON FUNCTION increment_player_stats FROM public;
GRANT EXECUTE ON FUNCTION increment_player_stats TO authenticated;


-- ─── 7. FIX #11: Tabella dedicata storico infortuni ──────────────────────────
CREATE TABLE IF NOT EXISTS player_injuries (
  id               TEXT        PRIMARY KEY,
  team_id          UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id        TEXT        NOT NULL,
  injury_type      TEXT,
  status           TEXT        NOT NULL DEFAULT 'Infortunato',
  start_date       DATE,
  end_date         DATE,
  expected_return  DATE,
  sessions_missed  INT         NOT NULL DEFAULT 0,
  matches_missed   INT         NOT NULL DEFAULT 0,
  days_out         INT GENERATED ALWAYS AS (
    CASE WHEN end_date IS NOT NULL AND start_date IS NOT NULL
         THEN (end_date - start_date)::int ELSE NULL END
  ) STORED,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_injuries_team_player
  ON player_injuries (team_id, player_id);

CREATE INDEX IF NOT EXISTS player_injuries_active
  ON player_injuries (team_id, status)
  WHERE end_date IS NULL;

ALTER TABLE player_injuries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_iso_all_player_injuries" ON player_injuries;
CREATE POLICY "team_iso_all_player_injuries"
  ON player_injuries FOR ALL
  USING     (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))
  WITH CHECK(team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
