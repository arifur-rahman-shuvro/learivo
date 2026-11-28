import { DIFFICULTY_ORDER, MODE_ORDER, type Difficulty, type ModeId } from "./config.ts";

export type Quality = "high" | "low";

export interface Settings {
  sound: boolean;
  vibration: boolean;
  quality: Quality;
  difficulty: Difficulty;
  mode: ModeId;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  vibration: true,
  quality: "high",
  difficulty: "medium",
  mode: "quick",
};

const SETTINGS_KEY = "learivo.cricket.settings";
const bestKey = (m: ModeId, d: Difficulty) => `learivo.cricket.best.${m}.${d}`;

/** Storage can be blocked or full: every call is safe and the game works without it. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function loadSettings(): Settings {
  const raw = read(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    return {
      sound: typeof o.sound === "boolean" ? o.sound : DEFAULT_SETTINGS.sound,
      vibration: typeof o.vibration === "boolean" ? o.vibration : DEFAULT_SETTINGS.vibration,
      quality: o.quality === "low" || o.quality === "high" ? o.quality : DEFAULT_SETTINGS.quality,
      difficulty: DIFFICULTY_ORDER.find((d) => d === o.difficulty) ?? DEFAULT_SETTINGS.difficulty,
      mode: MODE_ORDER.find((m) => m === o.mode) ?? DEFAULT_SETTINGS.mode,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, JSON.stringify(s));
}

/** Best score for this mode and difficulty on this phone. */
export function loadBest(m: ModeId, d: Difficulty): number {
  const n = Number(read(bestKey(m, d)));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Saves the score if it beats the best; returns whether it did. */
export function saveBest(m: ModeId, d: Difficulty, score: number): boolean {
  if (!(score > loadBest(m, d))) return false;
  write(bestKey(m, d), String(Math.floor(score)));
  return true;
}
