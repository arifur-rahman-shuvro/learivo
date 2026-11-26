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

// ---- Push notifications from the Learivo Coach (supabase/functions/push) ----
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Learivo", body: event.data ? event.data.text() : "" };
  }
  const buttons = Array.isArray(data.buttons) ? data.buttons.slice(0, 2) : [];
  event.waitUntil(
    self.registration.showNotification(data.title || "Learivo", {
      body: data.body || "",
      // A newer message of the same kind replaces an older one that is still showing.
      tag: data.tag || data.kind || "learivo",
      icon: "/brand/brand-logo-240.png",
      badge: "/brand/notification-badge-96.png",
      actions: buttons.map((b) => ({ action: String(b.action), title: String(b.title) })),
      data: { go: data.go || "quick", id: data.id || null, act: data.act || null },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const note = event.notification;
  const data = note.data || {};
  note.close();
  // "Later" silences the Coach for an hour, without opening the app.
  if (event.action === "later" && data.act) {
    event.waitUntil(fetch(`${data.act}&do=later`, { method: "POST" }).catch(() => undefined));
    return;
  }
  const go = event.action === "start" || !event.action ? data.go : "quick";
  const url = `/#/notify?go=${encodeURIComponent(go || "quick")}${data.id ? `&n=${data.id}` : ""}`;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) {
        if (!client.url.startsWith(self.location.origin)) continue;
        await client.focus();
        try {
          await client.navigate(url);
        } catch {
          /* The page can still be reached by opening a window below. */
          await self.clients.openWindow(url);
        }
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
