-- =============================================================================
-- CalcioLab — incremento atomico vip_points (fix race condition update-vip)
-- 2026-06-07
--
-- CONTEXT
--   update-vip (Edge Function) faceva SELECT vip_points → calcola newPoints
--   lato JS → UPDATE separato. Due chiamate concorrenti (es. doppio evento
--   ravvicinato) potevano leggere lo stesso valore di partenza: la seconda
--   UPDATE sovrascrive la prima, perdendo punti (lost update).
--
-- FIX
--   Funzione Postgres che esegue lettura+calcolo+scrittura in una singola
--   istruzione atomica (UPDATE ... SET vip_points = vip_points + delta
--   ... RETURNING), eliminando del tutto la finestra di race. SECURITY
--   DEFINER perché chiamata dall'Edge Function con service role.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_vip_points(p_team_id uuid, p_delta integer)
RETURNS TABLE (
  id uuid,
  vip_points integer,
  previous_level text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- NB: nella clausola RETURNING di un UPDATE, le colonne non presenti nel
  -- SET (qui vip_level) riflettono il valore della riga al momento
  -- dell'aggiornamento — cioè il livello "precedente" a questa scrittura.
  -- Il nuovo livello viene calcolato e scritto separatamente dalla Edge
  -- Function in base al nuovo punteggio restituito qui.
  RETURN QUERY
  UPDATE public.teams AS t
  SET
    vip_points = GREATEST(0, COALESCE(t.vip_points, 0) + p_delta),
    vip_updated_at = now()
  WHERE t.id = p_team_id
  RETURNING t.id, t.vip_points, t.vip_level;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_vip_points(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_vip_points(uuid, integer) TO service_role;
