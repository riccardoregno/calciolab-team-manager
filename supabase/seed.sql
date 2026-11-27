-- Explicit local-only demo seed. Automatic seeding is disabled in config.toml.
BEGIN;

INSERT INTO public.teams (id, name, season, category, onboarding_completed)
VALUES
  ('5eed0000-0000-4000-8000-000000000001', 'TEST A', '2026/27', 'TEST', true),
  ('5eed0000-0000-4000-8000-000000000002', 'TEST B', '2026/27', 'TEST', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_seasons (id, team_id, name, start_date, end_date, request_id, request_payload)
VALUES
  ('5eed0000-0000-4000-8000-000000000011', '5eed0000-0000-4000-8000-000000000001',
    '2026/27', '2026-07-01', '2027-06-30', '5eed0000-0000-4000-8000-000000000021', '{"fixture":true}'),
  ('5eed0000-0000-4000-8000-000000000012', '5eed0000-0000-4000-8000-000000000002',
    '2026/27', '2026-07-01', '2027-06-30', '5eed0000-0000-4000-8000-000000000022', '{"fixture":true}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.players (id, team_id, data)
VALUES
  ('5eed0000-0000-4000-8000-000000000031', '5eed0000-0000-4000-8000-000000000001',
    '{"name":"Giocatore TEST A1","role":"Difensore","status":"Disponibile"}'),
  ('5eed0000-0000-4000-8000-000000000032', '5eed0000-0000-4000-8000-000000000002',
    '{"name":"Giocatore TEST B1","role":"Portiere","status":"Disponibile"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_season_players (id, team_id, data)
SELECT v.id, p.team_id, jsonb_build_object('seasonId', v.season_id, 'playerId', p.id, 'profile', p.data)
FROM (VALUES
  ('5eed0000-0000-4000-8000-000000000041'::uuid, '5eed0000-0000-4000-8000-000000000031'::uuid,
    '5eed0000-0000-4000-8000-000000000011'::uuid),
  ('5eed0000-0000-4000-8000-000000000042'::uuid, '5eed0000-0000-4000-8000-000000000032'::uuid,
    '5eed0000-0000-4000-8000-000000000012'::uuid)
) AS v(id, player_id, season_id)
JOIN public.players p ON p.id = v.player_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.matches (id, team_id, data)
VALUES
  ('test-baseline-match-a', '5eed0000-0000-4000-8000-000000000001',
    '{"type":"Partita","title":"Partita TEST A","opponent":"Avversario TEST A","date":"2026-11-28","location":"Casa","seasonId":"5eed0000-0000-4000-8000-000000000011"}'),
  ('test-baseline-match-b', '5eed0000-0000-4000-8000-000000000002',
    '{"type":"Partita","title":"Partita TEST B","opponent":"Avversario TEST B","date":"2026-11-28","location":"Trasferta","seasonId":"5eed0000-0000-4000-8000-000000000012"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sessions (id, team_id, data)
VALUES
  ('test-baseline-session-a', '5eed0000-0000-4000-8000-000000000001',
    '{"type":"Allenamento","title":"Allenamento TEST A","date":"2026-11-27","duration":75,"seasonId":"5eed0000-0000-4000-8000-000000000011"}'),
  ('test-baseline-session-b', '5eed0000-0000-4000-8000-000000000002',
    '{"type":"Allenamento","title":"Allenamento TEST B","date":"2026-11-27","duration":75,"seasonId":"5eed0000-0000-4000-8000-000000000012"}')
ON CONFLICT (id) DO NOTHING;

COMMIT;
