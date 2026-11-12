// Large snapshots live outside Web Storage's small quota. No legacy keys are removed.
const DATABASE = 'calciolab-offline-v1';
const STORE = 'snapshots';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(new Error('IndexedDB blocked')); }, 3000);
    let request;
    try { request = globalThis.indexedDB.open(DATABASE, 1); }
    catch (error) { clearTimeout(timer); reject(error); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => { clearTimeout(timer); if (!settled) reject(request.error); };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (settled) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

export async function readLocalSnapshot(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let value;
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => { value = request.result; };
    tx.oncomplete = () => { db.close(); resolve(value || null); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('IndexedDB read failed')); };
  });
}

export async function updateLocalSnapshot(key, build) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let next;
    let failure;
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.get(key);
    request.onsuccess = () => {
      try { next = build(request.result || null); store.put(next, key); }
      catch (error) { failure = error; tx.abort(); }
    };
    // A successful put request is not a durable save until the transaction commits.
    tx.oncomplete = () => { db.close(); resolve(next); };
    tx.onabort = tx.onerror = () => { db.close(); reject(failure || tx.error || new Error('IndexedDB write failed')); };
  });
}
