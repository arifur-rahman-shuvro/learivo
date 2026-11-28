import type { Player, Rules } from "./config.ts";

/** Points and sets of a match. Everything here is a pure function: no screen, no clock. */
export interface Score {
  points: [number, number];
  sets: [number, number];
  /** Sets finished so far (also the number of the current set, counting from 0). */
  setIndex: number;
  /** Who served the first ball of the match. */
  firstServer: Player;
}

export const newScore = (firstServer: Player = 0): Score => ({
  points: [0, 0],
  sets: [0, 0],
  setIndex: 0,
  firstServer,
});

const other = (p: Player): Player => (p === 0 ? 1 : 0);

/** Sets needed to win the match. */
export const setsToWin = (r: Rules) => Math.ceil(r.bestOf / 2);

/** Both players are within one point of the target: serving changes every point and win-by-two applies. */
export function isDeuce(s: Score, r: Rules): boolean {
  return s.points[0] >= r.target - 1 && s.points[1] >= r.target - 1;
}

/**
 * Who serves the next ball. The server changes every two points; once both players are one point from
 * the target it changes every point. The first server of each set alternates.
 */
export function serverFor(s: Score, r: Rules): Player {
  const n = s.points[0] + s.points[1];
  const d = 2 * (r.target - 1);
  const swaps = n < d ? Math.floor(n / 2) : Math.floor(d / 2) + (n - d);
  const first = s.setIndex % 2 === 0 ? s.firstServer : other(s.firstServer);
  return swaps % 2 === 0 ? first : other(first);
}

/** The winner of the current set, or null while it is still being played. */
export function setWinner(s: Score, r: Rules): Player | null {
  for (const p of [0, 1] as const) {
    if (s.points[p] >= r.target && s.points[p] - s.points[other(p)] >= r.winBy) return p;
  }
  return null;
}

/** One more point for `p`. Returns the new score and whether that ended the set or the match. */
export function awardPoint(
  s: Score,
  r: Rules,
  p: Player,
): { score: Score; setWon: Player | null; matchWon: Player | null } {
  const points: [number, number] = [s.points[0], s.points[1]];
  points[p] += 1;
  const next: Score = { ...s, points };
  const w = setWinner(next, r);
  if (w === null) return { score: next, setWon: null, matchWon: null };
  const sets: [number, number] = [s.sets[0], s.sets[1]];
  sets[w] += 1;
  const done = sets[w] >= setsToWin(r);
  return {
    score: { ...s, points: done ? points : [0, 0], sets, setIndex: s.setIndex + 1 },
    setWon: w,
    matchWon: done ? w : null,
  };
}

/** `p` would win the current set with the next point. */
export function isSetPoint(s: Score, r: Rules, p: Player): boolean {
  return awardPoint(s, r, p).setWon === p;
}
/** `p` would win the whole match with the next point. */
export function isMatchPoint(s: Score, r: Rules, p: Player): boolean {
  return awardPoint(s, r, p).matchWon === p;
}
/** The player who is on match point right now, if any. */
export function matchPointFor(s: Score, r: Rules): Player | null {
  return isMatchPoint(s, r, 0) ? 0 : isMatchPoint(s, r, 1) ? 1 : null;
}
