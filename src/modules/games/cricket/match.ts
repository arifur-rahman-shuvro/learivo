import { CHASE_TARGET, MODES, type Difficulty, type ModeId } from "./config.ts";
import type { Outcome } from "./fielding.ts";

export interface Tally {
  runs: number;
  balls: number;
  wickets: number;
  results: Outcome[];
}

export const emptyTally = (): Tally => ({ runs: 0, balls: 0, wickets: 0, results: [] });

/** One legal delivery has been played; every ball counts (there are no wides or no-balls yet). */
export function applyOutcome(t: Tally, o: Outcome): Tally {
  return {
    runs: t.runs + o.runs,
    balls: t.balls + 1,
    wickets: t.wickets + (o.out ? 1 : 0),
    results: [...t.results, o],
  };
}

/** Runs to chase, or null when the mode has no target. */
export function targetFor(mode: ModeId, d: Difficulty): number | null {
  return mode === "chase" ? CHASE_TARGET[d] : null;
}

/** The innings ends on the last wicket, the last ball, or (in a chase) when the target is reached. */
export function isOver(t: Tally, mode: ModeId, target: number | null = null): boolean {
  const m = MODES[mode];
  return t.wickets >= m.wickets || t.balls >= m.balls || (target !== null && t.runs >= target);
}

export function chaseWon(t: Tally, target: number): boolean {
  return t.runs >= target;
}

/** "You won!" or how many runs short the chase finished. */
export function chaseVerdict(t: Tally, target: number): string {
  if (chaseWon(t, target)) return `You won! Target ${target} reached`;
  const short = target - t.runs;
  return `Lost. ${short} ${short === 1 ? "run" : "runs"} short of ${target}`;
}

/** "2.3" style overs from balls. */
export function overs(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

const STEPS: Record<ModeId, [number, number, number]> = {
  chase: [40, 30, 15],
  six: [30, 20, 10],
  quick: [25, 15, 6],
  wickets: [80, 50, 25],
};

export function verdict(runs: number, mode: ModeId): string {
  const [a, b, c] = STEPS[mode];
  if (runs >= a) return "Superstar innings";
  if (runs >= b) return "Match winner";
  if (runs >= c) return "Solid knock";
  return "Keep practising your timing";
}
