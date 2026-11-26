/**
 * The timer engine. It holds no clock of its own: every function is given "now", and time is
 * always worked out from timestamps (when it started, when it was paused, how much already ran).
 * That is why it stays right in a background tab, after a refresh, or after the phone slept.
 * Nothing here counts ticks.
 */

export type TimerMode = "pomodoro" | "stopwatch" | "countdown" | "custom";
export type Phase = "focus" | "short" | "long";
export type SessionStatus = "completed" | "interrupted" | "cancelled";

/** A session shorter than this is cancelled, not recorded as study. */
export const MIN_SESSION_SECONDS = 60;
/** No single session may be longer than a day. */
export const MAX_SESSION_SECONDS = 86400;

export interface TimerPlan {
  mode: TimerMode;
  /** Focus minutes for pomodoro, custom and countdown. Ignored by stopwatch. */
  focusMin: number;
  shortMin: number;
  longMin: number;
  /** Focus sessions before a long break. */
  cycles: number;
  /** Start the break by itself when focus ends. */
  autoBreak: boolean;
  /** Start the next focus by itself when a break ends. */
  autoFocus: boolean;
}

/** What is on the timer right now. A plain object so it can be stored and restored. */
export interface ActiveTimer {
  /** Made on the device when the phase starts; the session saved from it keeps this id. */
  id: string;
  plan: TimerPlan;
  phase: Phase;
  /** Focus sessions finished so far in this run (decides the long break). */
  done: number;
  /** When this phase was first started (ms since epoch). */
  startedAt: number;
  /** When it last started running; null while paused. */
  runningSince: number | null;
  /** Milliseconds that ran before `runningSince`. */
  carriedMs: number;
}

/** A finished focus session, ready to save. Breaks never become records. */
export interface FocusRecord {
  id: string;
  kind: TimerMode;
  status: SessionStatus;
  startedAt: string;
  endedAt: string;
  focusSeconds: number;
  plannedSeconds: number | null;
  /** The student's calendar day when it started, YYYY-MM-DD. */
  localDay: string;
}

export function plannedMs(t: ActiveTimer): number | null {
  if (t.plan.mode === "stopwatch") return t.phase === "focus" ? null : minutesToMs(breakMin(t));
  if (t.phase === "focus") return minutesToMs(t.plan.focusMin);
  return minutesToMs(breakMin(t));
}

function breakMin(t: ActiveTimer): number {
  return t.phase === "long" ? t.plan.longMin : t.plan.shortMin;
}

function minutesToMs(min: number): number {
  return Math.round(min * 60_000);
}

/** Time that has really run. A clock that jumped backwards adds nothing and never subtracts. */
export function elapsedMs(t: ActiveTimer, now: number): number {
  const running = t.runningSince === null ? 0 : Math.max(0, now - t.runningSince);
  const total = t.carriedMs + running;
  const plan = plannedMs(t);
  return Math.min(plan ?? MAX_SESSION_SECONDS * 1000, Math.max(0, total));
}

export function remainingMs(t: ActiveTimer, now: number): number | null {
  const plan = plannedMs(t);
  return plan === null ? null : Math.max(0, plan - elapsedMs(t, now));
}

/** 0 to 1. A stopwatch has no end, so it fills once an hour. */
export function progress(t: ActiveTimer, now: number): number {
  const plan = plannedMs(t) ?? 3_600_000;
  const e = plannedMs(t) === null ? elapsedMs(t, now) % 3_600_000 : elapsedMs(t, now);
  return Math.min(1, e / plan);
}

export function isRunning(t: ActiveTimer): boolean {
  return t.runningSince !== null;
}

/** True once a phase with an end has run its full time. */
export function isFinished(t: ActiveTimer, now: number): boolean {
  const plan = plannedMs(t);
  return plan !== null && elapsedMs(t, now) >= plan;
}

/** The moment a running phase reached its end (used when the app was closed past that point). */
export function endedAtMs(t: ActiveTimer): number | null {
  const plan = plannedMs(t);
  if (plan === null || t.runningSince === null) return null;
  return t.runningSince + Math.max(0, plan - t.carriedMs);
}

export function start(plan: TimerPlan, now: number, id: string): ActiveTimer {
  return { id, plan, phase: "focus", done: 0, startedAt: now, runningSince: now, carriedMs: 0 };
}

export function pause(t: ActiveTimer, now: number): ActiveTimer {
  if (t.runningSince === null) return t;
  return { ...t, carriedMs: elapsedMs(t, now), runningSince: null };
}

export function resume(t: ActiveTimer, now: number): ActiveTimer {
  if (t.runningSince !== null || isFinished(t, now)) return t;
  return { ...t, runningSince: now };
}

/** Back to zero, paused, same phase. For a focus phase the session id is renewed. */
export function reset(t: ActiveTimer, now: number, id: string): ActiveTimer {
  return { ...t, id, startedAt: now, runningSince: null, carriedMs: 0 };
}

/** Back to zero and running. */
export function restart(t: ActiveTimer, now: number, id: string): ActiveTimer {
  return { ...reset(t, now, id), runningSince: now };
}

function localDayOf(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Turns the focus phase into a record. Only focus time that really ran is counted, and time spent
 * paused is not. Under a minute is "cancelled"; a phase cut short is "interrupted"; one that ran
 * to its end (or a stopwatch that was finished on purpose) is "completed".
 */
export function toRecord(
  t: ActiveTimer,
  now: number,
  reason: "finished" | "stopped",
): FocusRecord | null {
  if (t.phase !== "focus") return null;
  const seconds = Math.min(MAX_SESSION_SECONDS, Math.floor(elapsedMs(t, now) / 1000));
  const plan = plannedMs(t);
  const ranToEnd = plan !== null && elapsedMs(t, now) >= plan;
  let status: SessionStatus;
  if (seconds < MIN_SESSION_SECONDS) status = "cancelled";
  else if (ranToEnd || (plan === null && reason === "stopped")) status = "completed";
  else status = "interrupted";
  const end = Math.max(t.startedAt, now);
  return {
    id: t.id,
    kind: t.plan.mode,
    status,
    startedAt: new Date(t.startedAt).toISOString(),
    endedAt: new Date(end).toISOString(),
    focusSeconds: seconds,
    plannedSeconds: plan === null ? null : Math.round(plan / 1000),
    localDay: localDayOf(t.startedAt),
  };
}

export interface Step {
  /** The timer after the step; null when the run is over (countdown, stopwatch, or stopped). */
  next: ActiveTimer | null;
  /** The session to save, if a focus phase just ended. */
  record: FocusRecord | null;
}

/**
 * The phase ran its full time: save the focus session and move on. After focus comes a short or
 * long break; after a break comes the next focus. Countdown and custom single timers end.
 */
export function finishPhase(t: ActiveTimer, now: number, newId: string): Step {
  const at = endedAtMs(t) ?? now;
  const record = toRecord(t, Math.min(now, at), "finished");
  if (t.plan.mode === "stopwatch" || t.plan.mode === "countdown") {
    return { next: null, record };
  }
  if (t.phase === "focus") {
    const done = t.done + 1;
    const phase: Phase = done % Math.max(1, t.plan.cycles) === 0 ? "long" : "short";
    return {
      record,
      next: {
        id: newId,
        plan: t.plan,
        phase,
        done,
        startedAt: now,
        runningSince: t.plan.autoBreak ? now : null,
        carriedMs: 0,
      },
    };
  }
  return { record: null, next: nextFocus(t, now, newId, t.plan.autoFocus) };
}

function nextFocus(t: ActiveTimer, now: number, id: string, run: boolean): ActiveTimer {
  return {
    id,
    plan: t.plan,
    phase: "focus",
    done: t.done,
    startedAt: now,
    runningSince: run ? now : null,
    carriedMs: 0,
  };
}

/** Skip the rest of a break and get the next focus ready (paused, one tap to start). */
export function skipBreak(t: ActiveTimer, now: number, newId: string): ActiveTimer {
  if (t.phase === "focus") return t;
  return nextFocus(t, now, newId, false);
}

/** Skip ahead from a focus phase: saves what was done, then offers the break. */
export function nextSession(t: ActiveTimer, now: number, newId: string): Step {
  if (t.phase !== "focus") return { record: null, next: skipBreak(t, now, newId) };
  const record = toRecord(t, now, "stopped");
  if (t.plan.mode === "stopwatch" || t.plan.mode === "countdown") return { record, next: null };
  const done = t.done + (record && record.status !== "cancelled" ? 1 : 0);
  const phase: Phase = done > 0 && done % Math.max(1, t.plan.cycles) === 0 ? "long" : "short";
  return {
    record,
    next: {
      id: newId,
      plan: t.plan,
      phase,
      done,
      startedAt: now,
      runningSince: null,
      carriedMs: 0,
    },
  };
}

/** The student ends the run: whatever focus time ran is saved. */
export function stop(t: ActiveTimer, now: number): FocusRecord | null {
  return toRecord(t, now, "stopped");
}

/** "25:00", or "1:05:09" from an hour. Counts down by rounding up, so 0:00 means finished. */
export function clock(ms: number, round: "up" | "down" = "down"): string {
  const total = Math.max(0, round === "up" ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** "1h 05m", "25 min", "40 s" for totals. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Checks a restored object before trusting it (storage can hold anything). */
export function cleanActive(raw: unknown): ActiveTimer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const plan = cleanPlan(r.plan);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const startedAt = num(r.startedAt);
  const carried = num(r.carriedMs);
  const done = num(r.done);
  const running = r.runningSince === null ? null : num(r.runningSince);
  if (
    typeof r.id !== "string" ||
    r.id.length < 8 ||
    !plan ||
    (r.phase !== "focus" && r.phase !== "short" && r.phase !== "long") ||
    startedAt === null ||
    carried === null ||
    carried < 0 ||
    done === null ||
    done < 0 ||
    (r.runningSince !== null && running === null)
  )
    return null;
  return {
    id: r.id,
    plan,
    phase: r.phase,
    done: Math.floor(done),
    startedAt,
    runningSince: running,
    carriedMs: carried,
  };
}

export function cleanPlan(raw: unknown): TimerPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const modes: TimerMode[] = ["pomodoro", "stopwatch", "countdown", "custom"];
  if (!modes.includes(r.mode as TimerMode)) return null;
  const n = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
  return {
    mode: r.mode as TimerMode,
    focusMin: n(r.focusMin, 1, 600, 25),
    shortMin: n(r.shortMin, 1, 120, 5),
    longMin: n(r.longMin, 1, 180, 15),
    cycles: n(r.cycles, 1, 12, 4),
    autoBreak: r.autoBreak !== false,
    autoFocus: r.autoFocus === true,
  };
}
