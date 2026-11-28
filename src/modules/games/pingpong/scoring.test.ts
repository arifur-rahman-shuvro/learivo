import { describe, expect, it } from "vitest";
import type { Rules } from "./config.ts";
import {
  awardPoint,
  isDeuce,
  isMatchPoint,
  isSetPoint,
  matchPointFor,
  newScore,
  serverFor,
  setWinner,
  setsToWin,
  type Score,
} from "./scoring.ts";

const R11: Rules = { target: 11, winBy: 2, bestOf: 1 };
const R5: Rules = { target: 5, winBy: 2, bestOf: 1 };
const R5x3: Rules = { target: 5, winBy: 2, bestOf: 3 };
const at = (a: number, b: number, extra: Partial<Score> = {}): Score => ({
  ...newScore(0),
  points: [a, b],
  ...extra,
});

describe("serving", () => {
  it("the server changes every two points", () => {
    const seq = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => serverFor(at(n, 0), R5));
    expect(seq).toEqual([0, 0, 1, 1, 0, 0, 1, 1]);
  });
  it("from deuce on, the server changes every point", () => {
    // target 5: deuce starts at 4-4 (8 points played)
    const seq = [8, 9, 10, 11, 12].map((n) => serverFor(at(n / 2, n / 2), R5));
    expect(seq).toEqual([0, 1, 0, 1, 0]);
    expect(serverFor(at(5, 4), R5)).toBe(1);
    expect(serverFor(at(5, 5), R5)).toBe(0);
  });
  it("the first server of each set alternates", () => {
    expect(serverFor(at(0, 0, { setIndex: 0 }), R11)).toBe(0);
    expect(serverFor(at(0, 0, { setIndex: 1 }), R11)).toBe(1);
    expect(serverFor(at(0, 0, { setIndex: 2 }), R11)).toBe(0);
    expect(serverFor({ ...newScore(1), setIndex: 0 }, R11)).toBe(1);
  });
});

describe("winning a set", () => {
  it("needs the target and a two-point lead", () => {
    expect(setWinner(at(11, 9), R11)).toBe(0);
    expect(setWinner(at(9, 11), R11)).toBe(1);
    expect(setWinner(at(11, 10), R11)).toBeNull();
    expect(setWinner(at(10, 10), R11)).toBeNull();
    expect(setWinner(at(12, 10), R11)).toBe(0);
    expect(setWinner(at(12, 11), R11)).toBeNull();
    expect(setWinner(at(10, 8), R11)).toBeNull();
    expect(setWinner(at(5, 3), R5)).toBe(0);
    expect(setWinner(at(5, 4), R5)).toBeNull();
    expect(setWinner(at(6, 4), R5)).toBe(0);
  });
  it("deuce starts one point below the target for both players", () => {
    expect(isDeuce(at(10, 10), R11)).toBe(true);
    expect(isDeuce(at(10, 9), R11)).toBe(false);
    expect(isDeuce(at(11, 10), R11)).toBe(true);
    expect(isDeuce(at(4, 4), R5)).toBe(true);
  });
  it("play goes on past the target until someone leads by two", () => {
    let s = at(10, 10);
    for (const p of [0, 1, 0, 1] as const) {
      const r = awardPoint(s, R11, p);
      expect(r.setWon).toBeNull();
      s = r.score;
    }
    expect(s.points).toEqual([12, 12]);
    s = awardPoint(s, R11, 1).score;
    const last = awardPoint(s, R11, 1);
    expect(last.setWon).toBe(1);
    expect(last.matchWon).toBe(1);
  });
});

describe("a match", () => {
  it("a one-set match ends with the set and keeps the final points", () => {
    const r = awardPoint(at(10, 3), R11, 0);
    expect(r.matchWon).toBe(0);
    expect(r.score.sets).toEqual([1, 0]);
    expect(r.score.points).toEqual([11, 3]);
  });
  it("best of 3 needs two sets; points reset between sets", () => {
    expect(setsToWin(R5x3)).toBe(2);
    const r1 = awardPoint(at(4, 1), R5x3, 0);
    expect(r1.setWon).toBe(0);
    expect(r1.matchWon).toBeNull();
    expect(r1.score).toMatchObject({ points: [0, 0], sets: [1, 0], setIndex: 1 });
    const r2 = awardPoint({ ...r1.score, points: [2, 4] }, R5x3, 1);
    expect(r2.score).toMatchObject({ sets: [1, 1], setIndex: 2 });
    expect(r2.matchWon).toBeNull();
    const r3 = awardPoint({ ...r2.score, points: [4, 0] }, R5x3, 0);
    expect(r3.matchWon).toBe(0);
    expect(r3.score.sets).toEqual([2, 1]);
  });
  it("best of 5 needs three sets", () => {
    expect(setsToWin({ ...R5, bestOf: 5 })).toBe(3);
    const r = awardPoint({ ...at(4, 0), sets: [1, 2] }, { ...R5, bestOf: 5 }, 0);
    expect(r.setWon).toBe(0);
    expect(r.matchWon).toBeNull();
  });
  it("set point and match point are announced for the right player", () => {
    expect(isSetPoint(at(10, 7), R11, 0)).toBe(true);
    expect(isSetPoint(at(10, 7), R11, 1)).toBe(false);
    expect(isSetPoint(at(10, 10), R11, 0)).toBe(false);
    expect(isSetPoint(at(10, 9), R11, 0)).toBe(true);
    expect(isMatchPoint(at(4, 2), R5, 0)).toBe(true);
    expect(isMatchPoint(at(4, 2), R5x3, 0)).toBe(false);
    expect(isMatchPoint(at(4, 2, { sets: [1, 0] }), R5x3, 0)).toBe(true);
    expect(matchPointFor(at(3, 3), R5)).toBeNull();
    expect(matchPointFor(at(2, 4), R5)).toBe(1);
  });
  it("a point never changes the score it was given", () => {
    const s = at(3, 3);
    awardPoint(s, R5, 0);
    expect(s.points).toEqual([3, 3]);
  });
});
