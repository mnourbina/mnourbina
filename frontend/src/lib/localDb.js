import Dexie from "dexie";

/**
 * Khalaba local store — Dexie (IndexedDB) wrapper.
 * Stores offline mutations that must be replayed once the network returns.
 *
 * Each pending entry has:
 *  - id (auto, primary key)
 *  - endpoint (path, e.g. "/cpn")
 *  - method ("POST" | "PATCH")
 *  - payload (JSON)
 *  - kind (display label: "CPN", "Visite postnatale", ...)
 *  - createdAt (ISO)
 *  - status ("pending" | "syncing" | "synced" | "failed")
 *  - lastError (string | null)
 */
export const localDb = new Dexie("khalaba_local_v1");

localDb.version(1).stores({
  pending: "++id, endpoint, status, createdAt, kind",
});

export async function enqueueMutation({ endpoint, method = "POST", payload, kind }) {
  return localDb.pending.add({
    endpoint,
    method,
    payload,
    kind,
    status: "pending",
    createdAt: new Date().toISOString(),
    lastError: null,
  });
}

export async function listPending() {
  return localDb.pending.orderBy("createdAt").toArray();
}

export async function countPending() {
  return localDb.pending.where("status").anyOf(["pending", "failed"]).count();
}

export async function markStatus(id, status, lastError = null) {
  return localDb.pending.update(id, { status, lastError });
}

export async function deleteEntry(id) {
  return localDb.pending.delete(id);
}
