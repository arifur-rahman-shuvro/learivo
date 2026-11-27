/**
 * Mini cricket rules. Plain TypeScript, no React. One over of six balls, two wickets.
 *
 * Each ball arrives at a known moment. The player swings once; how close the swing is to that moment
 * (the "offset" in milliseconds, negative = too early, positive = too late) decides the shot.
 * Every dice roll comes from an injected `rnd`, so tests can force any outcome.
 */

export const BALLS = 6;
export const WICKETS = 2;

/** How far from the perfect moment a swing can be and still give each shot, in milliseconds. */
export const WINDOWS = { perfect: 50, good: 110, ok: 190, edge: 280 } as const;

/** Chance an edged shot is caught. */
export const EDGE_CAUGHT = 0.4;
/** Chance that a swing and a miss (or no swing) clips the stumps. A swing that is only a little off is a dot ball otherwise. */
export const MISS_BOWLED = 0.5;

export type Kind = "six" | "four" | "two" | "single" | "dot" | "bowled" | "caught";
export type Side = "leg" | "straight" | "off";

export interface Result {
  kind: Kind;
  runs: number;
  out: boolean;
  /** Which way the ball goes: early swings go to the leg side, late ones to the off side. */
  side: Side;
  label: string;
}

export function sideOf(offsetMs: number): Side {
  if (offsetMs < -WINDOWS.perfect) return "leg";
  if (offsetMs > WINDOWS.perfect) return "off";
  return "straight";
}

/**
 * The result of a swing. `offsetMs` is null when the player never swung.
 * The closer to perfect, the more runs: six, four, two, one; past the edge window it is a miss.
 */
export function judge(offsetMs: number | null, rnd: () => number): Result {
  if (offsetMs === null) {
    return {
      kind: "bowled",
      runs: 0,
      out: true,
      side: "straight",
      label: "Bowled! You did not swing",
    };
  }
  const d = Math.abs(offsetMs);
  const side = sideOf(offsetMs);
  if (d <= WINDOWS.perfect) return { kind: "six", runs: 6, out: false, side, label: "SIX!" };
  if (d <= WINDOWS.good) return { kind: "four", runs: 4, out: false, side, label: "FOUR!" };
  if (d <= WINDOWS.ok) return { kind: "two", runs: 2, out: false, side, label: "Two runs" };
  if (d <= WINDOWS.edge) {
    return rnd() < EDGE_CAUGHT
      ? { kind: "caught", runs: 0, out: true, side, label: "Edged and caught!" }
      : { kind: "single", runs: 1, out: false, side, label: "Edged for a single" };
  }
  const how = offsetMs < 0 ? "Too early" : "Too late";
  return rnd() < MISS_BOWLED
    ? { kind: "bowled", runs: 0, out: true, side, label: `${how}. Bowled!` }
    : { kind: "dot", runs: 0, out: false, side, label: `${how}. Missed, a dot ball` };
}

export interface BallPlan {
  /** Wait before the bowler lets go, so the player cannot just count a rhythm. */
  delayMs: number;
  /** Time the ball takes to reach the bat. Later balls are faster. */
  speedMs: number;
}

export const MIN_SPEED_MS = 700;

export function newBall(index: number, rnd: () => number): BallPlan {
  return {
    delayMs: Math.round(600 + rnd() * 800),
    speedMs: Math.max(MIN_SPEED_MS, Math.round(1300 - index * 60 - rnd() * 200)),
  };
}

export interface Innings {
  runs: number;
  wickets: number;
  balls: number;
  over: boolean;
}

export function innings(results: readonly Result[]): Innings {
  const runs = results.reduce((n, r) => n + r.runs, 0);
  const wickets = results.filter((r) => r.out).length;
  const balls = results.length;
  return { runs, wickets, balls, over: balls >= BALLS || wickets >= WICKETS };
}

/** A short line for the final score. */
export function verdict(runs: number): string {
  if (runs >= 30) return "Superstar innings";
  if (runs >= 20) return "Match winner";
  if (runs >= 10) return "Solid knock";
  return "Keep practising your timing";
}
