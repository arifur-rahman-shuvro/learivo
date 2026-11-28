import {
  BEST_OF,
  LEVEL_ORDER,
  TARGETS,
  THEME_ORDER,
  type Level,
  type Mode,
  type PracticeSpeed,
  type Rules,
  type ThemeId,
} from "./config.ts";

export type Quality = "high" | "low";

export interface Settings {
  sound: boolean;
  /** 0 to 1. */
  volume: number;
  vibration: boolean;
  quality: Quality;
  /** How far the paddle goes for a finger movement: 0.9 (precise) to 1.5 (short drags). */
  sensitivity: number;
  theme: ThemeId;
  mode: Mode;
  level: Level;
  practiceSpeed: PracticeSpeed;
  target: Rules["target"];
  bestOf: Rules["bestOf"];
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.7,
  vibration: true,
  quality: "high",
  sensitivity: 1.15,
  theme: "midnight",
  mode: "ai",
  level: "normal",
  practiceSpeed: "normal",
  target: 11,
  bestOf: 1,
};

const SETTINGS_KEY = "learivo.pingpong.settings";
const STATS_KEY = "learivo.pingpong.stats";

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

const num = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const pick = <T extends string | number>(list: readonly T[], v: unknown, fallback: T): T =>
  list.find((x) => x === v) ?? fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function loadSettings(): Settings {
  const raw = read(SETTINGS_KEY);
  const d = DEFAULT_SETTINGS;
  if (!raw) return { ...d };
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    return {
      sound: bool(o.sound, d.sound),
      volume: num(o.volume, 0, 1, d.volume),
      vibration: bool(o.vibration, d.vibration),
      quality: pick(["high", "low"] as const, o.quality, d.quality),
      sensitivity: num(o.sensitivity, 0.9, 1.5, d.sensitivity),
      theme: pick(THEME_ORDER, o.theme, d.theme),
      mode: pick(["ai", "local", "practice"] as const, o.mode, d.mode),
      level: pick(LEVEL_ORDER, o.level, d.level),
      practiceSpeed: pick(["slow", "normal", "fast"] as const, o.practiceSpeed, d.practiceSpeed),
      target: pick(TARGETS, o.target, d.target),
      bestOf: pick(BEST_OF, o.bestOf, d.bestOf),
    };
  } catch {
    return { ...d };
  }
}

export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, JSON.stringify(s));
}

/** Records kept on this phone. Local matches have no "you", so they only add to the shared totals. */
export interface Records {
  /** Matches against the computer, per level. */
  ai: { [L in Level]: { won: number; lost: number } };
  localMatches: number;
  /** Longest rally ever, counting every mode. */
  longestRally: number;
  /** Longest practice rally. */
  practiceRally: number;
  hits: number;
  perfect: number;
  smashes: number;
  points: number;
  seconds: number;
}

export const emptyRecord = (): Records => ({
  ai: {
    easy: { won: 0, lost: 0 },
    normal: { won: 0, lost: 0 },
    hard: { won: 0, lost: 0 },
    expert: { won: 0, lost: 0 },
  },
  localMatches: 0,
  longestRally: 0,
  practiceRally: 0,
  hits: 0,
  perfect: 0,
  smashes: 0,
  points: 0,
  seconds: 0,
});

export function loadRecord(): Records {
  const base = emptyRecord();
  const raw = read(STATS_KEY);
  if (!raw) return base;
  try {
    const o = JSON.parse(raw) as Partial<Records>;
    for (const l of LEVEL_ORDER) {
      base.ai[l].won = num(o.ai?.[l]?.won, 0, 1e9, 0);
      base.ai[l].lost = num(o.ai?.[l]?.lost, 0, 1e9, 0);
    }
    base.localMatches = num(o.localMatches, 0, 1e9, 0);
    base.longestRally = num(o.longestRally, 0, 1e9, 0);
    base.practiceRally = num(o.practiceRally, 0, 1e9, 0);
    base.hits = num(o.hits, 0, 1e9, 0);
    base.perfect = num(o.perfect, 0, 1e9, 0);
    base.smashes = num(o.smashes, 0, 1e9, 0);
    base.points = num(o.points, 0, 1e9, 0);
    base.seconds = num(o.seconds, 0, 1e9, 0);
    return base;
  } catch {
    return base;
  }
}

export interface MatchSummary {
  mode: Mode;
  level: Level;
  /** Did the human (player 0) win? Meaningless for local and practice. */
  won: boolean;
  longestRally: number;
  hits: number;
  perfect: number;
  smashes: number;
  points: number;
  seconds: number;
}

/** Adds one finished match (or practice session) to the records and saves them. */
export function recordMatch(m: MatchSummary): Records {
  const r = loadRecord();
  if (m.mode === "ai") r.ai[m.level][m.won ? "won" : "lost"]++;
  else if (m.mode === "local") r.localMatches++;
  if (m.mode === "practice") r.practiceRally = Math.max(r.practiceRally, m.longestRally);
  r.longestRally = Math.max(r.longestRally, m.longestRally);
  r.hits += m.hits;
  r.perfect += m.perfect;
  r.smashes += m.smashes;
  r.points += m.points;
  r.seconds += Math.round(m.seconds);
  write(STATS_KEY, JSON.stringify(r));
  return r;
}

export function resetRecord() {
  write(STATS_KEY, JSON.stringify(emptyRecord()));
}
