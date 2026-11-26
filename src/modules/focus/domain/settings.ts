import { cleanPlan, type TimerMode, type TimerPlan } from "./engine.ts";

export interface Preset {
  id: string;
  name: string;
  plan: TimerPlan;
}

export interface FocusSettings {
  /** The plan the Start button uses (its mode is the default timer mode). */
  plan: TimerPlan;
  presets: Preset[];
  hour12: boolean;
  /** "ring": circular progress with big digits. "digits": only the big digits. */
  display: "ring" | "digits";
  showProgressBar: boolean;
  /** A message when a phase ends and the app is in the background (needs the browser's permission). */
  notify: boolean;
  vibrate: boolean;
  /** Ask the screen to stay on while a focus session runs. */
  keepAwake: boolean;
}

export const MAX_PRESETS = 8;

export const DEFAULT_PLAN: TimerPlan = {
  mode: "pomodoro",
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  cycles: 4,
  autoBreak: true,
  autoFocus: false,
};

export const DEFAULT_SETTINGS: FocusSettings = {
  plan: DEFAULT_PLAN,
  presets: [],
  hour12: true,
  display: "ring",
  showProgressBar: true,
  notify: true,
  vibrate: true,
  keepAwake: true,
};

/** What a new student can pick from before making their own. */
export const BUILT_IN_PRESETS: readonly Preset[] = [
  { id: "classic", name: "Classic 25/5", plan: { ...DEFAULT_PLAN, mode: "pomodoro" } },
  {
    id: "deep",
    name: "Deep 50/10",
    plan: { ...DEFAULT_PLAN, mode: "pomodoro", focusMin: 50, shortMin: 10, longMin: 20, cycles: 3 },
  },
  {
    id: "sprint",
    name: "Sprint 15/3",
    plan: { ...DEFAULT_PLAN, mode: "pomodoro", focusMin: 15, shortMin: 3, longMin: 10, cycles: 4 },
  },
];

/** Cleans whatever was stored (older versions, hand edits, a different device). */
export function cleanSettings(raw: unknown): FocusSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const plan = cleanPlan(r.plan) ?? DEFAULT_PLAN;
  const presets: Preset[] = [];
  if (Array.isArray(r.presets)) {
    for (const p of r.presets) {
      if (!p || typeof p !== "object") continue;
      const q = p as Record<string, unknown>;
      const pp = cleanPlan(q.plan);
      const name = typeof q.name === "string" ? q.name.trim().slice(0, 30) : "";
      if (!pp || !name || typeof q.id !== "string" || q.id.length < 4) continue;
      if (presets.some((x) => x.id === q.id)) continue;
      presets.push({ id: q.id.slice(0, 40), name, plan: pp });
      if (presets.length >= MAX_PRESETS) break;
    }
  }
  return {
    plan,
    presets,
    hour12: r.hour12 !== false,
    display: r.display === "digits" ? "digits" : "ring",
    showProgressBar: r.showProgressBar !== false,
    notify: r.notify !== false,
    vibrate: r.vibrate !== false,
    keepAwake: r.keepAwake !== false,
  };
}

export const MODE_LABEL: Record<TimerMode, string> = {
  pomodoro: "Pomodoro",
  stopwatch: "Stopwatch",
  countdown: "Countdown",
  custom: "Custom",
};

/** "12:05 PM" or "12:05" in the student's chosen clock. */
export function timeOfDay(iso: string, hour12: boolean): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12,
  });
}
