import { useEffect, useState } from "react";

/** True while the device has a network connection. It says "offline" for sure, "online" only likely. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

type Listener = (waiting: ServiceWorker | null) => void;
let waiting: ServiceWorker | null = null;
const listeners = new Set<Listener>();

function setWaiting(w: ServiceWorker | null) {
  waiting = w;
  listeners.forEach((l) => l(w));
}

/** Registers the service worker (production only) and tracks a new version waiting to start. */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        const track = (sw: ServiceWorker | null) => {
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            // A new version finished installing while an old one controls the page.
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => track(reg.installing));
        // Look for a new version when the app is opened again after a while.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
        });
      })
      .catch(() => undefined); // The app works without it; it just cannot go offline.
  });
  let reloading = false;
  // The very first install also changes the controller; only reload for real updates.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });
}

/** The waiting new version, if any, and a function that switches to it. */
export function useUpdate(): { ready: boolean; apply: () => void } {
  const [w, setW] = useState<ServiceWorker | null>(waiting);
  useEffect(() => {
    const l: Listener = (next) => setW(next);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return { ready: w !== null, apply: () => w?.postMessage({ type: "SKIP_WAITING" }) };
}
