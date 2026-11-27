import { describe, expect, it } from "vitest";
import {
  BALLS,
  EDGE_CAUGHT,
  MISS_BOWLED,
  WICKETS,
  WINDOWS,
  innings,
  judge,
  newBall,
  sideOf,
  verdict,
  type Result,
} from "./rules.ts";

const never = () => 0.999; // no dice event happens
const always = () => 0; // every dice event happens

describe("judge", () => {
  it("gives six, four, two or an edge by how close the swing is, on both sides of perfect", () => {
    for (const sign of [1, -1]) {
      expect(judge(sign * 0, never)).toMatchObject({ kind: "six", runs: 6, out: false });
      expect(judge(sign * WINDOWS.perfect, never)).toMatchObject({ kind: "six", runs: 6 });
      expect(judge(sign * (WINDOWS.perfect + 1), never)).toMatchObject({ kind: "four", runs: 4 });
      expect(judge(sign * WINDOWS.good, never)).toMatchObject({ kind: "four", runs: 4 });
      expect(judge(sign * (WINDOWS.good + 1), never)).toMatchObject({ kind: "two", runs: 2 });
      expect(judge(sign * WINDOWS.ok, never)).toMatchObject({ kind: "two", runs: 2 });
      expect(judge(sign * (WINDOWS.ok + 1), never)).toMatchObject({ kind: "single", runs: 1 });
      expect(judge(sign * WINDOWS.edge, never)).toMatchObject({ kind: "single", runs: 1 });
    }
  });

  it("an edge is caught only when the dice say so", () => {
    expect(judge(WINDOWS.edge, () => EDGE_CAUGHT - 0.01)).toMatchObject({
      kind: "caught",
      out: true,
      runs: 0,
    });
    expect(judge(WINDOWS.edge, () => EDGE_CAUGHT)).toMatchObject({ kind: "single", out: false });
  });

  it("a miss is bowled or a dot ball by the dice, and says whether it was early or late", () => {
    expect(judge(WINDOWS.edge + 1, () => MISS_BOWLED - 0.01)).toMatchObject({
      kind: "bowled",
      out: true,
    });
    expect(judge(WINDOWS.edge + 1, () => MISS_BOWLED)).toMatchObject({
      kind: "dot",
      out: false,
      runs: 0,
    });
    expect(judge(-500, always).label).toContain("Too early");
    expect(judge(500, always).label).toContain("Too late");
    expect(judge(500, never).label).toContain("Too late");
  });

  it("not swinging is always out, whatever the dice", () => {
    expect(judge(null, never)).toMatchObject({ kind: "bowled", out: true, runs: 0 });
    expect(judge(null, always)).toMatchObject({ kind: "bowled", out: true });
  });

  it("is never worse for being closer to perfect (runs never fall as the swing gets better)", () => {
    for (const sign of [1, -1]) {
      let best = -1;
      for (let d = 600; d >= 0; d--) {
        const r = judge(sign * d, never).runs; // dice never fire: the pure timing ladder
        expect(r).toBeGreaterThanOrEqual(best);
        best = r;
      }
    }
  });

  it("sends early swings to the leg side, late ones to the off side, and perfect ones straight", () => {
    expect(sideOf(-WINDOWS.perfect - 1)).toBe("leg");
    expect(sideOf(WINDOWS.perfect + 1)).toBe("off");
    expect(sideOf(0)).toBe("straight");
    expect(sideOf(-WINDOWS.perfect)).toBe("straight");
  });
});

describe("newBall", () => {
  it("waits 0.6 to 1.4 seconds, and gets faster with each ball but never below the floor", () => {
    expect(newBall(0, always)).toEqual({ delayMs: 600, speedMs: 1300 });
    expect(newBall(0, never).delayMs).toBe(1399); // 0.999 of the way to 1400
    expect(newBall(5, always).speedMs).toBe(1000);
    expect(newBall(5, never).speedMs).toBeLessThan(newBall(0, never).speedMs);
    expect(newBall(50, always).speedMs).toBeGreaterThanOrEqual(700);
  });
});

const r = (runs: number, out = false): Result => ({
  kind: out ? "bowled" : "dot",
  runs,
  out,
  side: "straight",
  label: "",
});

describe("innings", () => {
  it("adds runs and wickets", () => {
    expect(innings([r(6), r(4), r(0, true)])).toMatchObject({
      runs: 10,
      wickets: 1,
      balls: 3,
      over: false,
    });
  });
  it("ends after six balls, or at two wickets, whichever comes first", () => {
    expect(innings(Array(BALLS - 1).fill(r(1))).over).toBe(false);
    expect(innings(Array(BALLS).fill(r(1))).over).toBe(true);
    expect(innings([r(0, true)]).over).toBe(false);
    expect(innings(Array(WICKETS).fill(r(0, true))).over).toBe(true);
  });
  it("the best possible innings is thirty-six", () => {
    expect(innings(Array(BALLS).fill(r(6))).runs).toBe(36);
  });
});

describe("verdict", () => {
  it("rewards a big score", () => {
    expect(verdict(36)).toBe("Superstar innings");
    expect(verdict(29)).toBe("Match winner");
    expect(verdict(10)).toBe("Solid knock");
    expect(verdict(0)).toBe("Keep practising your timing");
  });
});
