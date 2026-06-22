import axios from "axios";
import { enqueueRequest, drainQueue } from "./offlineQueue";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Mutations to NEVER queue (auth flows always need a live network)
const NEVER_QUEUE = [/^\/auth\//i];

function shouldQueue(config) {
  const method = (config.method || "GET").toUpperCase();
  if (!MUTATING.has(method)) return false;
  const path = (config.url || "").replace(API_BASE, "");
  if (NEVER_QUEUE.some((rx) => rx.test(path))) return false;
  return true;
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const config = error.config || {};
    const isOffline = !navigator.onLine || error.code === "ERR_NETWORK" || error.message === "Network Error";
    // Only queue on offline + safe mutations + not a replay
    if (isOffline && shouldQueue(config) && !config.headers?.["X-Offline-Replay"]) {
      await enqueueRequest({
        method: config.method,
        url: config.url,
        data: config.data ? (typeof config.data === "string" ? JSON.parse(config.data) : config.data) : null,
        headers: {},
      });
      // Return an optimistic 202 so callers don't crash
      return Promise.resolve({
        status: 202,
        statusText: "Queued offline",
        data: { __queued: true, message: "Enregistré localement, sera synchronisé." },
        headers: {},
        config,
      });
    }
    return Promise.reject(error);
  }
);

// Auto-drain when browser comes back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    drainQueue(api).then((res) => {
      if (res.drained > 0 || res.failed > 0) {
        window.dispatchEvent(new CustomEvent("khalaba:sync", { detail: res }));
      }
    });
  });
  // Try draining on startup too (e.g., user reloads after coming back online)
  window.addEventListener("load", () => {
    if (navigator.onLine) {
      drainQueue(api).then((res) => {
        if (res.drained > 0) {
          window.dispatchEvent(new CustomEvent("khalaba:sync", { detail: res }));
        }
      });
    }
  });
}

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Une erreur est survenue. Veuillez réessayer.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
