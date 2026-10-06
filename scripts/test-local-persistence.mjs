import assert from 'node:assert/strict';
import { createServer } from 'vite';

process.env.VITE_SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'placeholder';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
const pendingValues = new Map();
globalThis.sessionStorage = {
  getItem: (key) => pendingValues.get(key) ?? null,
  setItem: (key, value) => pendingValues.set(key, value),
  removeItem: (key) => pendingValues.delete(key),
};
globalThis.window = {
  addEventListener() {},
  requestIdleCallback() { throw new Error('Local persistence must be synchronous'); },
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { loadLocalState, saveLocalState, loadRemoteState } = await server.ssrLoadModule('/src/services/teamData.js');
  const { supabase } = await server.ssrLoadModule('/src/lib/supabaseClient.js');
  const { uploadTeamAttachment } = await server.ssrLoadModule('/src/services/attachments.js');
  const { persistPendingChanges, restorePendingChanges, acknowledgePendingChanges } = await server.ssrLoadModule('/src/services/pendingChanges.js');
  const { normalizeAppState } = await server.ssrLoadModule('/src/utils/helpers.js');
  const baseline = normalizeAppState({
    matches: [{ id: 'match-reload', date: '2026-10-04', _updatedAt: 'version-1' }],
    sessions: [{ id: 'attendance-reload', date: '2026-10-06', attendance: {} }],
  });
  const edited = normalizeAppState({
    ...baseline,
    matches: [{ ...baseline.matches[0], date: '2026-10-05',
      convocazione: { playerIds: ['player-1'] },
      lineup: { calledUpIds: ['player-1'], starterIds: ['player-1'], formationPlans: { first: { slots: { goalkeeper: 'player-1' } } } },
    }],
    sessions: [{ ...baseline.sessions[0], attendance: { 'player-1': 'Presente' } }],
  });
  const token = persistPendingChanges('reload-team', baseline, edited, ['matches', 'sessions']);
  const restored = restorePendingChanges('reload-team', { state: baseline, source: 'supabase' });
  assert.deepEqual(restored.state.matches[0].convocazione.playerIds, ['player-1']);
  assert.deepEqual(restored.state.matches[0].lineup.starterIds, ['player-1']);
  assert.equal(restored.state.matches[0].lineup.formationPlans.first.slots.goalkeeper, 'player-1');
  assert.equal(restored.state.matches[0].date, '2026-10-05', 'Calendar edits must survive reload before cloud acknowledgement');
  assert.equal(restored.state.sessions[0].attendance['player-1'], 'Presente');
  assert.equal(restored.source, 'pending-upload');
  assert.deepEqual(restored.pendingKeys, ['matches', 'sessions']);
  assert.equal(restorePendingChanges('other-team', { state: baseline }).state, baseline, 'Do not mix teams');
  const newerToken = persistPendingChanges('reload-team', baseline, { ...edited, sessions: [] }, ['matches', 'sessions']);
  acknowledgePendingChanges('reload-team', token);
  assert.equal(restorePendingChanges('reload-team', { state: baseline }).state.sessions.length, 0, 'An older save must not erase a newer pending deletion');
  acknowledgePendingChanges('reload-team', newerToken);
  assert.equal(pendingValues.size, 0);
  persistPendingChanges('reload-team', baseline, edited, ['matches', 'sessions']);
  const acknowledged = restorePendingChanges('reload-team', { state: edited, source: 'supabase' });
  assert.equal(acknowledged.pendingKeys.length, 0, 'Completed saves must not be replayed');
  assert.equal(pendingValues.has('calciolab-pending-v1:reload-team'), false, 'Acknowledged journals must not replay after a later remote change');
  persistPendingChanges('reload-team', baseline, edited, ['matches', 'sessions']);
  const concurrentRemote = { ...baseline, matches: [{ ...baseline.matches[0], result: '1-0', _updatedAt: 'version-2' }] };
  const conflictRecovery = restorePendingChanges('reload-team', { state: concurrentRemote, source: 'supabase' });
  assert.equal(conflictRecovery.syncBaseline.matches[0]._updatedAt, 'version-1', 'Recovery must preserve optimistic conflict detection');
  for (const entity of ['players', 'exercises', 'sessions', 'matches', 'physicalTests', 'gpsSessions', 'staffTasks', 'injuryRecords']) {
    const before = { [entity]: [{ id: 'existing', note: 'old' }] };
    const after = { [entity]: [{ id: 'existing', note: 'new' }, { id: 'added', note: 'added' }] };
    persistPendingChanges('matrix-team', before, after, [entity]);
    assert.deepEqual(restorePendingChanges('matrix-team', { state: before, source: 'supabase' }).state[entity], after[entity], `${entity}: edits and additions survive reload`);
  }
  const settingsBefore = { appSettings: { name: 'before' }, setPlays: { corners: { note: 'before' } } };
  const settingsAfter = { appSettings: { name: 'after' }, setPlays: { corners: { note: 'after' } } };
  persistPendingChanges('settings-team', settingsBefore, settingsAfter, ['appSettings', 'setPlays']);
  assert.deepEqual(restorePendingChanges('settings-team', { state: settingsBefore, source: 'supabase' }).state, settingsAfter);
  assert.deepEqual(restorePendingChanges('reload-team', { state: baseline, source: 'local', error: new Error('offline') }).state.matches[0].convocazione.playerIds, ['player-1'], 'An unavailable server must not discard the journal');
  assert.deepEqual(restorePendingChanges('reload-team', { state: edited, source: 'local', error: new Error('offline') }).pendingKeys, ['matches', 'sessions'], 'A local fallback is not a cloud acknowledgement');
  const key = 'calciolab-platform-v2';
  const backupKey = `${key}:backup`;
  const snapshot = { matches: [{ id: 'test-match', opponent: 'Saved locally', result: '2-0' }] };

  values.set(key, '{broken');
  values.set(backupKey, JSON.stringify(snapshot));
  assert.equal(loadLocalState().matches[0].result, '2-0', 'A corrupt primary must recover from backup');

  values.set(key, JSON.stringify(snapshot));
  values.set(backupKey, '{broken');
  assert.equal(loadLocalState().matches[0].result, '2-0', 'A corrupt backup must not discard a valid primary');

  values.clear();
  saveLocalState(snapshot);
  assert.equal(JSON.parse(values.get(key)).matches[0].result, '2-0');
  saveLocalState({ ...snapshot, matches: [{ ...snapshot.matches[0], result: '3-0' }] });
  assert.equal(JSON.parse(values.get(key)).matches[0].result, '3-0');
  assert.equal(JSON.parse(values.get(backupKey)).matches[0].result, '2-0');

  assert.ok(supabase, 'Remote-read regression requires the configured Supabase client');
  const originalFrom = supabase.from;
  supabase.from = () => ({
    select: () => ({ eq: async () => ({
      data: [{ id: 'test-match', data: { opponent: 'Stale remote', result: '1-0' } }], error: null,
    }) }),
  });
  try {
    const before = new Map(values);
    const remote = await loadRemoteState({ teamId: 'test-team', entityKeys: ['matches'] });
    assert.equal(remote.state.matches[0].result, '1-0');
    assert.deepEqual(values, before, 'A remote read must not overwrite local edits or their backup');
  } finally {
    supabase.from = originalFrom;
  }

  await assert.rejects(uploadTeamAttachment({ teamId: 'test-team', folder: 'matches/test', file: {
    name: 'distinta.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1,
  } }), /10 MB/);
  await assert.rejects(uploadTeamAttachment({ teamId: 'test-team', folder: 'matches/test', file: {
    name: 'distinta.heic', type: 'image/heic', size: 100,
  } }), /Formato non supportato/);
  const originalStorageFrom = supabase.storage.from;
  let uploadedType;
  supabase.storage.from = () => ({
    upload: async (_path, _file, options) => { uploadedType = options.contentType; return { error: null }; },
    getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/distinta.pdf' } }),
  });
  try {
    const attachment = await uploadTeamAttachment({ teamId: 'test-team', folder: 'matches/test', file: {
      name: 'distinta.pdf', type: '', size: 100,
    } });
    assert.equal(uploadedType, 'application/pdf');
    assert.equal(attachment.type, 'application/pdf');
    assert.equal(attachment.url, 'https://example.test/distinta.pdf');
  } finally {
    supabase.storage.from = originalStorageFrom;
  }
  console.log('Local persistence regression tests passed');
} finally {
  await server.close();
  delete globalThis.window;
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
}
