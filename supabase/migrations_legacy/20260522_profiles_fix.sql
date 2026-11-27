-- =============================================================================
-- CalcioLab — Fix profiles table + auto-create trigger
-- Eseguire su Supabase Dashboard > SQL Editor
-- =============================================================================

-- ─── 1. Crea/aggiorna la tabella profiles ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name        TEXT        NOT NULL DEFAULT '',
  last_name         TEXT        NOT NULL DEFAULT '',
  email             TEXT,
  newsletter_opt_in BOOLEAN     NOT NULL DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aggiunge le colonne mancanti se la tabella esiste già
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email             TEXT,
  ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT now();


-- ─── 2. RLS policies ──────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON public.profiles;

-- SELECT: ogni utente vede solo il proprio profilo
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- INSERT: ogni utente può inserire solo il proprio profilo
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- UPDATE: ogni utente può aggiornare solo il proprio profilo
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);


-- ─── 3. Trigger: crea il profilo automaticamente al signup ───────────────────
-- SECURITY DEFINER bypassa RLS → funziona anche con email confirmation attiva,
-- quando auth.uid() non è ancora disponibile lato client.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    newsletter_opt_in,
    terms_accepted_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'newsletter_opt_in')::boolean, false),
    CASE
      WHEN NEW.raw_user_meta_data->>'terms_accepted_at' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;  -- se esiste già non sovrascrive
  RETURN NEW;
END;
$$;

-- Ricrea il trigger (DROP + CREATE per idempotenza)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
