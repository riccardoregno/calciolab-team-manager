-- =============================================================================
-- CalcioLab — player_availability
--
-- Giocatori dichiarano la propria disponibilità per un range di date.
-- Lo staff vede tutto il team; ogni giocatore scrive solo il proprio record.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.player_availability (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id   TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'unavailable', 'doubtful')),
  reason      TEXT,
  date_from   DATE        NOT NULL,
  date_to     DATE,                        -- NULL = solo date_from
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_availability_team_player_idx
  ON public.player_availability (team_id, player_id);

CREATE INDEX IF NOT EXISTS player_availability_dates_idx
  ON public.player_availability (team_id, date_from, date_to);

ALTER TABLE public.player_availability ENABLE ROW LEVEL SECURITY;

-- ─── SELECT: tutti i membri del team ─────────────────────────────────────────
CREATE POLICY "pa_select_team_members"
  ON public.player_availability FOR SELECT
  USING (team_id = ANY(public.get_my_team_ids()));

-- ─── INSERT: giocatore su se stesso, oppure staff con area 'availability' ────
CREATE POLICY "pa_insert"
  ON public.player_availability FOR INSERT
  WITH CHECK (
    -- il giocatore può inserire solo record per il proprio player_id
    player_id = COALESCE(
      (SELECT pa.player_id FROM public.player_accounts pa
       WHERE pa.auth_user_id = auth.uid() AND pa.team_id = player_availability.team_id
       LIMIT 1),
      ''
    )
    OR public.can_manage_team_area(team_id, 'availability')
  );

-- ─── UPDATE: stesso criterio ─────────────────────────────────────────────────
CREATE POLICY "pa_update"
  ON public.player_availability FOR UPDATE
  USING (
    player_id = COALESCE(
      (SELECT pa.player_id FROM public.player_accounts pa
       WHERE pa.auth_user_id = auth.uid() AND pa.team_id = player_availability.team_id
       LIMIT 1),
      ''
    )
    OR public.can_manage_team_area(team_id, 'availability')
  )
  WITH CHECK (
    player_id = COALESCE(
      (SELECT pa.player_id FROM public.player_accounts pa
       WHERE pa.auth_user_id = auth.uid() AND pa.team_id = player_availability.team_id
       LIMIT 1),
      ''
    )
    OR public.can_manage_team_area(team_id, 'availability')
  );

-- ─── DELETE: stesso criterio ─────────────────────────────────────────────────
CREATE POLICY "pa_delete"
  ON public.player_availability FOR DELETE
  USING (
    player_id = COALESCE(
      (SELECT pa.player_id FROM public.player_accounts pa
       WHERE pa.auth_user_id = auth.uid() AND pa.team_id = player_availability.team_id
       LIMIT 1),
      ''
    )
    OR public.can_manage_team_area(team_id, 'availability')
  );
