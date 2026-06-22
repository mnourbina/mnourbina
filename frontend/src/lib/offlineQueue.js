// KHALABA — Brique 9 : Outbound queue (IndexedDB) for offline mutations
// Minimal, dependency-free IndexedDB wrapper. The queue stores POST/PATCH/PUT/DELETE
// requests that fail while the browser is offline, and drains them when reconnecting.

const DB_NAME = "khalaba-offline";
const DB_VERSION = 1;
const STORE_NAME = "outbound";

let _dbPromise = null;

function getDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function tx(mode, fn) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, mode);
    const store = t.objectStore(STORE_NAME);
    const out = fn(store);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
}

export async function enqueueRequest({ method, url, data, headers }) {
  const record = {
    method: (method || "POST").toUpperCase(),
    url,
    data: data ?? null,
    headers: headers || {},
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  await tx("readwrite", (store) => store.add(record));
  notifyListeners();
  return record;
}

export async function listPending() {
  return tx("readonly", (store) =>
    new Promise((resolve) => {
      const out = [];
      store.openCursor().onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) {
          out.push({ id: cur.key, ...cur.value });
          cur.continue();
        } else {
          resolve(out);
        }
      };
    })
  );
}

export async function pendingCount() {
  return tx("readonly", (store) =>
    new Promise((resolve) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    })
  );
}

export async function removeRequest(id) {
  await tx("readwrite", (store) => store.delete(id));
  notifyListeners();
}

export async function markRetry(id) {
  await tx("readwrite", (store) =>
    new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const v = req.result;
        if (!v) return resolve();
        v.retryCount = (v.retryCount || 0) + 1;
        store.put(v);
        resolve();
      };
    })
  );
}

export async function clearQueue() {
  await tx("readwrite", (store) => store.clear());
  notifyListeners();
}

// ---- Listener machinery (UI badge refresh) ----
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notifyListeners() {
  pendingCount().then((n) => listeners.forEach((fn) => fn(n)));
}

// ---- Drain ----
let _draining = false;
export async function drainQueue(apiInstance) {
  if (_draining) return { drained: 0, failed: 0 };
  _draining = true;
  let drained = 0;
  let failed = 0;
  try {
    const items = await listPending();
    for (const item of items) {
      try {
        await apiInstance.request({
          method: item.method,
          url: item.url,
          data: item.data,
          headers: { ...item.headers, "X-Offline-Replay": "1" },
        });
        await removeRequest(item.id);
        drained++;
      } catch (e) {
        // If still offline, abort; otherwise mark retry and continue
        if (!navigator.onLine) break;
        await markRetry(item.id);
        failed++;
        // If retried too many times, drop to avoid infinite loop
        if ((item.retryCount || 0) >= 5) {
          await removeRequest(item.id);
        }
      }
    }
  } finally {
    _draining = false;
    notifyListeners();
  }
  return { drained, failed };
}
