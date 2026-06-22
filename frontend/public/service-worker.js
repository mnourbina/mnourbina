/* KHALABA Service Worker — Brique 9 (PWA offline)
 * Strategies:
 *   - App shell (HTML / JS / CSS / icons) → cache-first, fallback to network
 *   - GET /api/* → network-first, fallback to cache (so we keep last-known data when offline)
 *   - Other API methods (POST/PATCH/PUT/DELETE) → pass-through (handled by JS outbound queue in api.js)
 *   - Navigation fallback → cached index.html (SPA offline route)
 */
const CACHE_VERSION = "khalaba-v1";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_GET_CACHE = `${CACHE_VERSION}-api-get`;

const APP_SHELL_PRECACHE = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      // Best-effort precache; ignore failures in dev mode where some chunks are hashed
      Promise.all(APP_SHELL_PRECACHE.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

async function networkFirstApiGet(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(API_GET_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ detail: "Hors ligne — donnée non mise en cache.", offline: true }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function cacheFirstShell(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && request.method === "GET") {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // SPA navigation fallback
    if (request.mode === "navigate") {
      const indexCached = await caches.match("/");
      if (indexCached) return indexCached;
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  if (isApiRequest(url)) {
    if (request.method === "GET") {
      event.respondWith(networkFirstApiGet(request));
    }
    // Mutating API calls: bypass SW; the JS outbound queue handles offline
    return;
  }

  // App shell + static assets
  if (request.method === "GET") {
    event.respondWith(cacheFirstShell(request));
  }
});

// Message channel — receive commands from the page (e.g., manual cache purge)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "PURGE_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});
