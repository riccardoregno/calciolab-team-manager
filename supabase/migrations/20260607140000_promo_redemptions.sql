-- =============================================================================
-- CalcioLab — promo codes: spostamento lato server (fix bypass billing)
-- 2026-06-07
--
-- CONTEXT
--   Il sistema di codici promo era interamente client-side:
--     • la lista dei codici (incluso un codice permanente "CALCIOLAB100" con
--       piano "club" e nessuna scadenza) era hardcoded nel bundle JS spedito
--       a ogni utente (src/utils/helpers.js, defaultPromoCodes);
--     • "PromoCodesCard" permetteva a QUALSIASI owner di team di creare
--       ulteriori codici permanenti e riscattarli all'istante;
--     • il riscatto scriveva solo in teams.settings (JSON, owner-writable) e
--       App.jsx faceva vincere il "promoOverride" locale sui dati Stripe
--       reali (subscription_plan/billing_status), perché "Supabase non sa
--       nulla delle promo".
--   Risultato: chiunque poteva leggere il codice nel bundle (devtools) o
--   crearne uno proprio e ottenere un piano "club" permanente gratuito,
--   bypassando completamente Stripe.
--
-- FIX
--   I codici promo e i riscatti diventano dati server-side, non leggibili né
--   scrivibili dal client (RLS senza policy = accesso negato a anon/authenticated;
--   solo l'Edge Function con service-role può operare). Il riscatto aggiorna
--   direttamente subscription_plan/billing_status (le colonne trusted lette da
--   App.jsx via remoteSubscription), eliminando la necessità di un override
--   locale lato client.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  plan        text NOT NULL DEFAULT 'premium' CHECK (plan IN ('premium', 'club')),
  permanent   boolean NOT NULL DEFAULT false,
  max_uses    integer NOT NULL DEFAULT 0,        -- 0 = illimitato
  expires_at  timestamptz,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id     uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, team_id)
);

CREATE INDEX IF NOT EXISTS promo_redemptions_team_id_idx ON public.promo_redemptions(team_id);
CREATE INDEX IF NOT EXISTS promo_redemptions_code_id_idx ON public.promo_redemptions(code_id);

ALTER TABLE public.promo_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Nessuna policy per anon/authenticated: il client non può leggere né scrivere
-- né la lista dei codici né i riscatti. Solo l'Edge Function (service-role,
-- che bypassa RLS) può operare — niente codici nel bundle, niente scritture
-- dirette da parte degli owner.

-- Migra il codice founder esistente (CALCIOLAB100) lato server, così chi lo ha
-- già riscattato localmente non perde l'accesso: la migrazione successiva del
-- redeem (lato Edge Function, idempotente) lo riconoscerà.
INSERT INTO public.promo_codes (code, plan, permanent, max_uses, note)
VALUES ('CALCIOLAB100', 'club', true, 0, 'Accesso gratuito riservato a famiglia, amici stretti e test interni.')
ON CONFLICT (code) DO NOTHING;
