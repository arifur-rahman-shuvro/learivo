import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { browserStore, FocusController, type FocusState } from "../domain/controller.ts";
import { clock, duration, elapsedMs, isRunning, remainingMs } from "../domain/engine.ts";
import type { FocusRepo } from "../data/repo.ts";

interface Value {
  controller: FocusController;
  state: FocusState;
}

const Ctx = createContext<Value | null>(null);

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const h = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}

/** The current time, refreshed `every` ms while `on`; one update when the tab comes back. */
export function useNow(on: boolean, every = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!on) return;
    const t = window.setInterval(() => setNow(Date.now()), every);
    const wake = () => setNow(Date.now());
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [on, every]);
  return now;
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Owns the one timer for a signed-in student and keeps it honest: it ticks the engine, keeps the
 * screen awake during focus where the browser allows, shows the time in the tab title, and tells
 * the student (vibration, a notification when the app is in the background) when a phase ends.
 */
export function FocusProvider({
  userId,
  repo,
  children,
}: {
  userId: string;
  repo: FocusRepo;
  children: ReactNode;
}) {
  const controller = useMemo(
    () =>
      new FocusController({
        userId,
        repo,
        store: browserStore(),
        now: () => Date.now(),
        newId: uuid,
      }),
    [userId, repo],
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const running = !!state.active && isRunning(state.active);
  const phase = state.active?.phase ?? null;

  useEffect(() => {
    void controller.load();
    const online = () => void controller.flush();
    const wake = () => {
      if (!document.hidden) controller.tick();
    };
    const storage = (e: StorageEvent) => {
      if (e.key?.startsWith("learivo.focus.active.")) controller.syncFromStorage();
    };
    window.addEventListener("online", online);
    window.addEventListener("pageshow", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", wake);
    const beat = window.setInterval(() => controller.heartbeat(), 15_000);
    const flush = window.setInterval(() => void controller.flush(), 60_000);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", wake);
      window.clearInterval(beat);
      window.clearInterval(flush);
    };
  }, [controller]);

  // Move to the next phase when time is up. The timeout aims at the exact end; the interval is a
  // safety net. Neither is trusted for the time itself: that always comes from timestamps.
  useEffect(() => {
    if (!running || !state.active) return;
    const left = remainingMs(state.active, Date.now());
    const exact = left === null ? undefined : window.setTimeout(() => controller.tick(), left + 30);
    const safety = window.setInterval(() => controller.tick(), 1000);
    return () => {
      if (exact !== undefined) window.clearTimeout(exact);
      window.clearInterval(safety);
    };
  }, [controller, running, state.active]);

  // Keep the screen on while studying, where the browser supports it.
  const keepAwake = running && phase === "focus" && state.settings.keepAwake;
  useEffect(() => {
    if (!keepAwake || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinelLike | null = null;
    let gone = false;
    const ask = () => {
      if (document.hidden || gone) return;
      (
        navigator as unknown as {
          wakeLock: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
        }
      ).wakeLock
        .request("screen")
        .then((l) => {
          if (gone) void l.release();
          else lock = l;
        })
        .catch(() => undefined); // refused (low battery, no support): the timer still works
    };
    ask();
    document.addEventListener("visibilitychange", ask);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", ask);
      void lock?.release().catch(() => undefined);
    };
  }, [keepAwake]);

  // The time in the tab title, so it is visible from other tabs.
  useEffect(() => {
    if (!running || !state.active) return;
    const base = document.title;
    const a = state.active;
    const paint = () => {
      const left = remainingMs(a, Date.now());
      const shown = left === null ? clock(elapsedMs(a, Date.now())) : clock(left, "up");
      document.title = `${shown} ${a.phase === "focus" ? "Focus" : "Break"} · Learivo`;
    };
    paint();
    const t = window.setInterval(paint, 1000);
    return () => {
      window.clearInterval(t);
      document.title = base;
    };
  }, [running, state.active]);

  // A phase ended by itself.
  const endedN = state.ended?.n ?? 0;
  useEffect(() => {
    const e = state.ended;
    if (!e) return;
    const s = state.settings;
    if (s.vibrate) navigator.vibrate?.([200, 100, 200]);
    if (!s.notify || !document.hidden) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const title = e.phase === "focus" ? "Focus session done" : "Break over";
    const body =
      e.phase === "focus"
        ? `${duration(e.record?.focusSeconds ?? 0)} of study saved. Time for a break.`
        : "Ready for the next session?";
    const opts = { body, tag: "learivo-focus", icon: "/icon-192.png" };
    void navigator.serviceWorker?.ready
      .then((r) => r.showNotification(title, opts))
      .catch(() => new Notification(title, opts));
    // Only a new ending should notify, not a settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endedN]);

  const value = useMemo(() => ({ controller, state }), [controller, state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFocus(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFocus must be used inside FocusProvider");
  return v;
}
