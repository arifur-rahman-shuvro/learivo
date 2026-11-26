import {
  cleanActive,
  finishPhase,
  isFinished,
  nextSession,
  pause,
  resume,
  reset,
  restart,
  skipBreak,
  start,
  stop,
  type ActiveTimer,
  type FocusRecord,
  type TimerPlan,
} from "./engine.ts";
import { cleanSettings, DEFAULT_SETTINGS, type FocusSettings } from "./settings.ts";
import type { FocusRepo } from "../data/repo.ts";

/** Small key-value store; the browser's localStorage in the app, a plain object in tests. */
export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function browserStore(): KeyValue {
  return {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* storage unavailable: the timer still works, it just cannot survive a refresh */
      }
    },
    remove: (k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* nothing to remove */
      }
    },
  };
}

export interface FocusState {
  active: ActiveTimer | null;
  /** Saved sessions plus any still waiting to be saved, newest first. */
  records: FocusRecord[];
  settings: FocusSettings;
  loaded: boolean;
  /** A problem the student should see, in plain words; null when all is well. */
  error: string | null;
  /** Sessions finished on this device that have not reached the server yet. */
  waiting: number;
  /** Which sessions those are, so the history can mark them. */
  pendingIds: readonly string[];
  /** Set when a running timer was found after the app had been closed for a while. */
  recovery: { seenAt: number } | null;
  /** Bumps each time a phase ends by itself, so the screen can chime and notify. */
  ended: { n: number; phase: "focus" | "break"; record: FocusRecord | null } | null;
}

export interface Deps {
  userId: string;
  repo: FocusRepo;
  store: KeyValue;
  now: () => number;
  newId: () => string;
}

/** A timer found running this long after it was last seen is asked about, not trusted blindly. */
export const RECOVERY_GAP_MS = 120_000;

/**
 * Everything the timer does, with no screen attached: it keeps the running timer in storage (so a
 * refresh or a closed tab loses nothing), saves finished sessions through a retry queue, and tells
 * the screen when something changed. The screen only draws it.
 */
export class FocusController {
  private state: FocusState = {
    active: null,
    records: [],
    settings: DEFAULT_SETTINGS,
    loaded: false,
    error: null,
    waiting: 0,
    pendingIds: [],
    recovery: null,
    ended: null,
  };
  private listeners = new Set<() => void>();
  private saved: FocusRecord[] = [];
  private flushing: Promise<void> | null = null;
  private endedCount = 0;

  constructor(private readonly d: Deps) {
    this.restoreLocal();
  }

  private key(name: string) {
    return `learivo.focus.${name}.${this.d.userId}`;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<FocusState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  // ---- storage -----------------------------------------------------------------------------

  private outbox(): FocusRecord[] {
    try {
      const raw = JSON.parse(this.d.store.get(this.key("outbox")) ?? "[]") as unknown;
      return Array.isArray(raw)
        ? (raw as FocusRecord[]).filter((r) => r && typeof r.id === "string")
        : [];
    } catch {
      return [];
    }
  }

  private writeOutbox(list: FocusRecord[]) {
    if (list.length === 0) this.d.store.remove(this.key("outbox"));
    else this.d.store.set(this.key("outbox"), JSON.stringify(list));
  }

  private persistActive(seenAt = this.d.now()) {
    const a = this.state.active;
    if (!a) this.d.store.remove(this.key("active"));
    else this.d.store.set(this.key("active"), JSON.stringify({ ...a, seenAt }));
  }

  private pending() {
    const ids = this.outbox().map((r) => r.id);
    return { waiting: ids.length, pendingIds: ids };
  }

  private merged(): FocusRecord[] {
    const waiting = this.outbox();
    const ids = new Set(this.saved.map((r) => r.id));
    const all = [...this.saved, ...waiting.filter((r) => !ids.has(r.id))];
    return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  /** What can be known without the network: the running timer, cached settings, waiting sessions. */
  private restoreLocal() {
    let active: ActiveTimer | null;
    let seenAt = this.d.now();
    try {
      const raw = JSON.parse(this.d.store.get(this.key("active")) ?? "null") as
        (Record<string, unknown> & { seenAt?: unknown }) | null;
      active = cleanActive(raw);
      if (raw && typeof raw.seenAt === "number") seenAt = raw.seenAt;
    } catch {
      active = null;
    }
    let settings = DEFAULT_SETTINGS;
    try {
      settings = cleanSettings(JSON.parse(this.d.store.get(this.key("settings")) ?? "null"));
    } catch {
      /* defaults */
    }
    this.state = { ...this.state, active, settings, ...this.pending(), records: this.merged() };
    if (active) this.reconcile(seenAt);
  }

  /** A timer from storage: finish it if it already ran out, or ask if the app was gone a while. */
  private reconcile(seenAt: number) {
    const a = this.state.active;
    if (!a) return;
    const now = this.d.now();
    if (a.runningSince !== null && isFinished(a, now)) {
      this.finish(a, now, false);
      return;
    }
    if (a.runningSince !== null && now - seenAt > RECOVERY_GAP_MS) {
      this.state = { ...this.state, recovery: { seenAt } };
    }
  }

  /** Reads the server: saved sessions and settings, then sends anything that was waiting. */
  async load() {
    try {
      const [rows, remote] = await Promise.all([this.d.repo.list(), this.d.repo.settings()]);
      this.saved = rows;
      const patch: Partial<FocusState> = { loaded: true, error: null };
      if (remote) {
        this.d.store.set(this.key("settings"), JSON.stringify(remote));
        patch.settings = remote;
      }
      this.set({ ...patch, records: this.merged() });
    } catch (e) {
      this.set({
        loaded: true,
        records: this.merged(),
        error: e instanceof Error ? e.message : "Could not load your study data.",
      });
    }
    await this.flush();
  }

  /** Sends waiting sessions. Safe to call any time: the same session is never saved twice. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      for (const r of this.outbox()) {
        try {
          await this.d.repo.save(r);
        } catch {
          break;
        }
        this.saved = [r, ...this.saved.filter((x) => x.id !== r.id)];
        this.writeOutbox(this.outbox().filter((x) => x.id !== r.id));
      }
      this.set({ ...this.pending(), records: this.merged() });
    })().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  // ---- the timer ---------------------------------------------------------------------------

  private commit(active: ActiveTimer | null) {
    this.state = { ...this.state, active };
    this.persistActive();
    this.set({ active });
  }

  private record(r: FocusRecord | null) {
    if (!r) return;
    this.writeOutbox([...this.outbox().filter((x) => x.id !== r.id), r]);
    this.set({ ...this.pending(), records: this.merged() });
    void this.flush();
  }

  private finish(a: ActiveTimer, now: number, announce: boolean) {
    const step = finishPhase(a, now, this.d.newId());
    this.record(step.record);
    this.state = { ...this.state, recovery: null };
    this.commit(step.next);
    if (announce) {
      this.endedCount += 1;
      this.set({
        ended: {
          n: this.endedCount,
          phase: a.phase === "focus" ? "focus" : "break",
          record: step.record,
        },
      });
    }
  }

  /** Called often by the screen, and when the tab comes back. Only moves when a phase has ended. */
  tick() {
    const a = this.state.active;
    if (a && a.runningSince !== null && isFinished(a, this.d.now()))
      this.finish(a, this.d.now(), true);
  }

  /** Keeps "last seen" fresh so a later recovery knows when the app went away. */
  heartbeat() {
    if (this.state.active) this.persistActive();
  }

  begin(plan?: TimerPlan) {
    if (this.state.active) return;
    this.commit(start(plan ?? this.state.settings.plan, this.d.now(), this.d.newId()));
  }

  pause() {
    const a = this.state.active;
    if (a) this.commit(pause(a, this.d.now()));
  }

  resume() {
    const a = this.state.active;
    if (a) this.commit(resume(a, this.d.now()));
  }

  reset() {
    const a = this.state.active;
    if (a) this.commit(reset(a, this.d.now(), this.d.newId()));
  }

  restart() {
    const a = this.state.active;
    if (a) this.commit(restart(a, this.d.now(), this.d.newId()));
  }

  skipBreak() {
    const a = this.state.active;
    if (a) this.commit(skipBreak(a, this.d.now(), this.d.newId()));
  }

  nextSession() {
    const a = this.state.active;
    if (!a) return;
    const step = nextSession(a, this.d.now(), this.d.newId());
    this.record(step.record);
    this.commit(step.next);
  }

  /** Ends the run. Focus time that ran is saved (as interrupted, or cancelled under a minute). */
  end() {
    const a = this.state.active;
    if (!a) return;
    this.record(stop(a, this.d.now()));
    this.state = { ...this.state, recovery: null };
    this.commit(null);
  }

  /** After a recovery prompt: keep counting from the original start. */
  keepRunning() {
    this.set({ recovery: null });
    this.persistActive();
  }

  /** After a recovery prompt: count only until the app was last seen, then save. */
  stopAtLastSeen() {
    const a = this.state.active;
    const r = this.state.recovery;
    if (!a || !r) return;
    this.record(stop(pause(a, r.seenAt), r.seenAt));
    this.set({ recovery: null });
    this.commit(null);
  }

  /** Another tab changed the running timer: follow it. */
  syncFromStorage() {
    try {
      const raw = JSON.parse(this.d.store.get(this.key("active")) ?? "null");
      this.set({ active: cleanActive(raw) });
    } catch {
      /* ignore a half-written value */
    }
  }

  // ---- history and settings ----------------------------------------------------------------

  async removeRecord(id: string) {
    this.writeOutbox(this.outbox().filter((r) => r.id !== id));
    try {
      await this.d.repo.remove(id);
      this.saved = this.saved.filter((r) => r.id !== id);
      this.set({ records: this.merged(), ...this.pending(), error: null });
    } catch (e) {
      this.set({ error: e instanceof Error ? e.message : "Could not delete that session." });
    }
  }

  async saveSettings(next: FocusSettings) {
    const s = cleanSettings(next);
    this.d.store.set(this.key("settings"), JSON.stringify(s));
    this.set({ settings: s });
    try {
      await this.d.repo.saveSettings(s);
      this.set({ error: null });
    } catch (e) {
      this.set({ error: e instanceof Error ? e.message : "Could not save your settings." });
    }
  }
}
