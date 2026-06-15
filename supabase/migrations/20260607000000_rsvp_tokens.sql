-- =============================================================================
-- CalcioLab — Public match RSVP tokens
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rsvp_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  match_id     TEXT        NOT NULL,
  player_id    TEXT        NOT NULL,
  token        TEXT        NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  response     TEXT        NOT NULL DEFAULT 'pending'
    CHECK (response IN ('pending', 'yes', 'no')),
  responded_at TIMESTAMPTZ,
  created_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rsvp_tokens_token_idx
  ON public.rsvp_tokens(token);

CREATE INDEX IF NOT EXISTS rsvp_tokens_match_idx
  ON public.rsvp_tokens(team_id, match_id);

CREATE UNIQUE INDEX IF NOT EXISTS rsvp_tokens_active_player_match_idx
  ON public.rsvp_tokens(team_id, match_id, player_id);

ALTER TABLE public.rsvp_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rsvp_tokens_select_team_members" ON public.rsvp_tokens;
CREATE POLICY "rsvp_tokens_select_team_members"
  ON public.rsvp_tokens
  FOR SELECT
  USING (team_id = ANY(public.get_my_team_ids()));

-- Inserts/updates/deletes are intentionally blocked for normal clients.
-- Edge Functions use the service role to generate tokens and record responses.
