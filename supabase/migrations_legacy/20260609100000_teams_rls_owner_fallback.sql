-- =============================================================================
-- CalcioLab — Teams RLS: aggiungi fallback owner_id per lettura
-- =============================================================================
-- PROBLEMA: la policy "team_members_can_read_own_team" richiede che l'utente
-- sia già in team_members per leggere il proprio team. Se la riga team_members
-- venisse persa (o non ancora creata in una race condition durante l'onboarding),
-- il proprietario del team si troverebbe bloccato fuori dalla propria squadra.
--
-- SOLUZIONE: estendere la USING clause con "OR owner_id = auth.uid()" come
-- fallback sicuro. Solo il proprietario beneficia di questo percorso alternativo;
-- per i membri normali la membership in team_members rimane il requisito.
-- =============================================================================

DROP POLICY IF EXISTS "team_members_can_read_own_team" ON teams;
CREATE POLICY "team_members_can_read_own_team"
  ON teams FOR SELECT
  USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR owner_id = auth.uid()
  );
