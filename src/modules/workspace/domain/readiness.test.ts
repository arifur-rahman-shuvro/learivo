import { describe, expect, it } from "vitest";
import type { Fact } from "./insights.ts";
import { allocate, explain, readiness, MIN_ANSWERS } from "./readiness.ts";

const NOW = new Date("2026-11-21T09:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const fact = (path: string, correct: boolean, d = 1): Fact => ({
  at: daysAgo(d),
  path: [path],
  correct,
});
const many = (path: string, right: number, wrong: number, d = 1) => [
  ...Array.from({ length: right }, () => fact(path, true, d)),
  ...Array.from({ length: wrong }, () => fact(path, false, d)),
];

describe("readiness", () => {
  it("gives no estimate with too few answers", () => {
    const r = readiness(many("A", 5, 5), NOW);
    expect(r.level).toBe("none");
    expect(r.estimate).toBeNull();
    expect(r.answers).toBe(10);
  });

  it("is early with a modest number of answers and fair with many", () => {
    expect(readiness(many("A", 15, 10), NOW).level).toBe("early");
    expect(readiness(many("A", 40, 30), NOW).level).toBe("fair");
  });

  it("reports a range around the estimate that narrows with more answers", () => {
    const few = readiness(many("A", 15, 5), NOW);
    const lots = readiness(many("A", 150, 50), NOW);
    expect(few.estimate!).toBeCloseTo(0.75, 2);
    expect(few.low!).toBeLessThan(few.estimate!);
    expect(few.high!).toBeGreaterThan(few.estimate!);
    expect(lots.high! - lots.low!).toBeLessThan(few.high! - few.low!);
  });

  it("counts recent answers more than old ones", () => {
    const recentGood = [...many("A", 20, 0, 1), ...many("A", 0, 20, 90)];
    const recentBad = [...many("A", 0, 20, 1), ...many("A", 20, 0, 90)];
    expect(readiness(recentGood, NOW).estimate!).toBeGreaterThan(0.9);
    expect(readiness(recentBad, NOW).estimate!).toBeLessThan(0.1);
  });

  it("orders areas weakest first and counts days since practice", () => {
    const r = readiness([...many("Strong", 18, 2), ...many("Weak", 6, 14, 20)], NOW);
    expect(r.areas.map((a) => a.name)).toEqual(["Weak", "Strong"]);
    expect(r.areas[0]!.daysSince).toBe(20);
    expect(r.answers).toBeGreaterThanOrEqual(MIN_ANSWERS);
  });
});

describe("allocate", () => {
  const facts = [...many("Strong", 18, 2), ...many("Weak", 6, 14), ...many("Mid", 10, 10)];

  it("always uses exactly the requested number of questions", () => {
    for (const n of [1, 3, 10, 20, 37]) {
      const a = allocate(readiness(facts, NOW), n);
      expect(a.reduce((s, x) => s + x.questions, 0)).toBe(n);
      expect(a.every((x) => x.questions >= 1)).toBe(true);
    }
  });

  it("gives the weakest area the biggest share", () => {
    const a = allocate(readiness(facts, NOW), 20);
    expect(a[0]!.name).toBe("Weak");
    expect(a[0]!.questions).toBeGreaterThan(a[a.length - 1]!.questions);
  });

  it("does not ignore a thinly tested area", () => {
    const thin = [...many("Strong", 40, 5), ...many("New", 2, 0)];
    const a = allocate(readiness(thin, NOW), 10);
    expect(a.map((x) => x.name)).toContain("New");
  });

  it("returns nothing when there is nothing to split", () => {
    expect(allocate(readiness([], NOW), 10)).toEqual([]);
    expect(allocate(readiness(facts, NOW), 0)).toEqual([]);
  });

  it("never uses more areas than questions", () => {
    expect(allocate(readiness(facts, NOW), 2).length).toBeLessThanOrEqual(2);
  });
});

describe("explain", () => {
  it("says the numbers it used", () => {
    const a = readiness(many("A", 6, 14), NOW).areas[0]!;
    expect(explain(a).join(" ")).toContain("30%");
    expect(explain(a).join(" ")).toContain("20 answers");
  });

  it("says when there is little to go on and when practice is old", () => {
    const a = readiness([...many("A", 40, 5), ...many("B", 2, 0, 30)], NOW).areas.find(
      (x) => x.name === "B",
    )!;
    const text = explain(a).join(" ");
    expect(text).toContain("Only 2 answers");
    expect(text).toContain("30 days");
  });
});
