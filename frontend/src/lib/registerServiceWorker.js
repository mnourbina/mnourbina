// KHALABA — Brique 9 : Service Worker registration helper
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Avoid HTTPS-only requirement breaking dev (CRA dev server is HTTP on localhost — SW works on localhost only)
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .catch((err) => {
        // Non-fatal: app still works without offline support
        // eslint-disable-next-line no-console
        console.warn("[KHALABA] SW registration failed:", err);
      });
  });
}
