/*
 * Learivo service worker.
 * - Installs by caching every file of the current build (listed in /asset-manifest.json), so
 *   every screen opens offline, including screens that were never visited online.
 * - Pages: network first, then the cached copy when offline.
 * - Built files (/assets/...): cache first, they never change under the same name.
 * - Anything on another site (the database, sign-in) is never touched or cached.
 */
const PREFIX = "learivo-";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch("/asset-manifest.json", { cache: "no-store" });
      const { build, files } = await res.json();
      const cache = await caches.open(PREFIX + build);
      await cache.addAll(files);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch("/asset-manifest.json", { cache: "no-store" }).catch(() => null);
      const current = res && res.ok ? PREFIX + (await res.json()).build : null;
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && key !== current) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function fromAnyCache(request) {
  for (const key of await caches.keys()) {
    if (!key.startsWith(PREFIX)) continue;
    const hit = await (
      await caches.open(key)
    ).match(request, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
  }
  return undefined;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js" || url.pathname === "/asset-manifest.json") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await fromAnyCache("/")) || Response.error()),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await fromAnyCache(request);
      if (cached) return cached;
      return fetch(request);
    })(),
  );
});
