-- =============================================================================
-- CalcioLab — riscatto codici promo atomico (fix race su max_uses)
-- 2026-06-07
--
-- CONTEXT
--   redeem-promo-code (Edge Function) faceva COUNT(*) sui riscatti esistenti
--   poi, se sotto il limite, INSERT — due team diversi che riscattano lo
--   stesso codice in parallelo possono entrambi superare il controllo del
--   COUNT prima che l'INSERT dell'altro si completi, sforando max_uses.
--
-- FIX
--   Funzione Postgres che esegue l'intero riscatto (verifica esistenza/
--   scadenza/limite, incremento contatore, registrazione riscatto,
--   aggiornamento piano del team) in un'unica transazione atomica.
--   L'incremento del contatore usa un UPDATE condizionale
--   (WHERE used_count < max_uses) che funge da lock ottimistico: sotto
--   concorrenza, solo le richieste che soddisfano la condizione al momento
--   dello UPDATE procedono — esattamente max_uses vincono, le altre
--   ricevono 'limit_reached'. SECURITY DEFINER perché chiamata
--   dall'Edge Function con service role.
-- =============================================================================

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_team_id uuid, p_code text)
RETURNS TABLE (
  status      text,   -- 'redeemed' | 'already_redeemed' | 'not_found' | 'expired' | 'limit_reached'
  plan        text,
  permanent   boolean,
  note        text,
  redeemed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code     record;
  v_existing record;
BEGIN
  SELECT * INTO v_code FROM public.promo_codes WHERE code = upper(trim(p_code));
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::boolean, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF NOT v_code.permanent AND v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, NULL::boolean, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO v_existing
  FROM public.promo_redemptions
  WHERE code_id = v_code.id AND team_id = p_team_id;

  IF FOUND THEN
    RETURN QUERY SELECT 'already_redeemed'::text, v_code.plan, v_code.permanent, v_code.note, v_existing.redeemed_at;
    RETURN;
  END IF;

  IF v_code.max_uses > 0 THEN
    -- UPDATE condizionale: sotto concorrenza, solo chi trova ancora
    -- used_count < max_uses al momento dello UPDATE incrementa con successo
    -- (lock di riga implicito di Postgres serializza i tentativi).
    UPDATE public.promo_codes
       SET used_count = used_count + 1
     WHERE id = v_code.id AND used_count < max_uses;

    IF NOT FOUND THEN
      RETURN QUERY SELECT 'limit_reached'::text, NULL::text, NULL::boolean, NULL::text, NULL::timestamptz;
      RETURN;
    END IF;
  ELSE
    UPDATE public.promo_codes SET used_count = used_count + 1 WHERE id = v_code.id;
  END IF;

  INSERT INTO public.promo_redemptions (code_id, team_id) VALUES (v_code.id, p_team_id);

  UPDATE public.teams
     SET subscription_plan = v_code.plan,
         billing_status    = 'active'
   WHERE id = p_team_id;

  RETURN QUERY SELECT 'redeemed'::text, v_code.plan, v_code.permanent, v_code.note, now();
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(uuid, text) TO service_role;
