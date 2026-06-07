-- =============================================================================
-- CalcioLab — team_members: dedup + vincolo di unicità (team_id, user_id)
-- 2026-06-07
--
-- CONTEXT
--   accept-team-invite (Edge Function) faceva SELECT esistenza-membership +
--   INSERT separati. Senza un vincolo UNIQUE su (team_id, user_id), un doppio
--   click / reload sul link invito durante la finestra tra SELECT e INSERT
--   produceva righe duplicate per lo stesso utente nello stesso team.
--   Caso reale riscontrato: Federico Lamma inserito 3 volte nel team
--   "Castenaso" (fa8ae1e8-387b-4a9a-a512-7010410b1557), tutte con ruolo
--   "assistantCoach", create a ~50ms di distanza l'una dall'altra.
--
-- STEP 1: rimuove i duplicati mantenendo la riga più vecchia per ciascuna
--         coppia (team_id, user_id) — preserva storicità/ruolo originale.
-- STEP 2: aggiunge il vincolo UNIQUE che impedisce il ripetersi del problema
--         (l'Edge Function viene aggiornata in parallelo per usare upsert
--         con onConflict su questa stessa coppia).
--
-- EXECUTION: idempotente — sicura da rieseguire.
-- =============================================================================

-- ─── 1. Rimuovi i duplicati, mantieni la riga più vecchia ────────────────────
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY team_id, user_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.team_members
)
DELETE FROM public.team_members tm
USING ranked
WHERE tm.id = ranked.id
  AND ranked.rn > 1;

-- ─── 2. Vincolo di unicità: un utente non può comparire due volte nello stesso team ──
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_team_user_unique;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_team_user_unique UNIQUE (team_id, user_id);

-- ─── 3. Verifica ──────────────────────────────────────────────────────────────
-- Dopo l'esecuzione, questa query deve restituire zero righe:
--
--   SELECT team_id, user_id, COUNT(*)
--   FROM   public.team_members
--   GROUP  BY team_id, user_id
--   HAVING COUNT(*) > 1;
