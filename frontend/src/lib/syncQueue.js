import { api, formatApiError } from "@/lib/api";
import { useNetwork } from "@/lib/network";
import { enqueueMutation, listPending, markStatus, deleteEntry } from "@/lib/localDb";

/**
 * Smart mutation:
 *  - online → call API, return response
 *  - offline → enqueue locally, return synthetic response { __queued: true, id }
 *
 * `kind` is a human label used in the sync queue UI (CPN, Visite postnatale, ...)
 */
export async function smartMutate({ endpoint, method = "POST", payload, kind }) {
  const online = useNetwork.getState().isOnline;
  if (!online) {
    const id = await enqueueMutation({ endpoint, method, payload, kind });
    return { __queued: true, id };
  }
  try {
    const res = method === "PATCH" ? await api.patch(endpoint, payload) : await api.post(endpoint, payload);
    return res.data;
  } catch (err) {
    // Network just dropped between check and request — enqueue as fallback
    if (!navigator.onLine) {
      const id = await enqueueMutation({ endpoint, method, payload, kind });
      return { __queued: true, id };
    }
    throw err;
  }
}

/**
 * Drain the queue. Returns { sent, failed }. Called when network is back.
 */
export async function drainQueue() {
  const items = await listPending();
  let sent = 0, failed = 0;
  for (const item of items) {
    if (item.status === "synced") continue;
    await markStatus(item.id, "syncing");
    try {
      if (item.method === "PATCH") {
        await api.patch(item.endpoint, item.payload);
      } else {
        await api.post(item.endpoint, item.payload);
      }
      await deleteEntry(item.id);
      sent++;
    } catch (err) {
      await markStatus(item.id, "failed", formatApiError(err));
      failed++;
    }
  }
  return { sent, failed };
}
