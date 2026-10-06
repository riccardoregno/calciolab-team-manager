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
globalThis.window = {
  addEventListener() {},
  requestIdleCallback() { throw new Error('Local persistence must be synchronous'); },
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { loadLocalState, saveLocalState, loadRemoteState } = await server.ssrLoadModule('/src/services/teamData.js');
  const { supabase } = await server.ssrLoadModule('/src/lib/supabaseClient.js');
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
  console.log('Local persistence regression tests passed');
} finally {
  await server.close();
  delete globalThis.window;
  delete globalThis.localStorage;
}
