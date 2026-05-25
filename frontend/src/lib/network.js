import { create } from "zustand";

/**
 * NetworkProvider — listens to browser online/offline events + manual checks.
 * Exposes: isOnline, lastChangedAt, setManualOffline (for dev / testing)
 */
export const useNetwork = create((set, get) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  lastChangedAt: null,
  manualOverride: false, // when true, ignore browser events (used by dev toggle)
  setOnline: (online) => {
    if (get().manualOverride) return;
    set({ isOnline: online, lastChangedAt: new Date().toISOString() });
  },
  setManualOverride: (override, online) => {
    set({ manualOverride: override, isOnline: override ? online : (typeof navigator !== "undefined" ? navigator.onLine : true), lastChangedAt: new Date().toISOString() });
  },
}));

/** Initialise browser listeners — called once in App.js */
export function initNetworkListeners() {
  if (typeof window === "undefined") return;
  const handleOnline = () => useNetwork.getState().setOnline(true);
  const handleOffline = () => useNetwork.getState().setOnline(false);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
