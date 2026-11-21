import { describe, expect, it } from "vitest";
import { weekPlan } from "./weekPlan.ts";

const now = new Date(2026, 10, 22, 9, 0); // Sun 22 Nov 2026
const due = [
  { day: "2026-11-22", count: 4 },
  { day: "2026-11-24", count: 2 },
];

describe("weekPlan", () => {
  it("has no plan without an exam date, or when the exam is today or past", () => {
    expect(weekPlan(null, 100, 0, due, now)).toEqual([]);
    expect(weekPlan("2026-11-22", 100, 0, due, now)).toEqual([]);
    expect(weekPlan("2026-11-01", 100, 0, due, now)).toEqual([]);
  });

  it("spreads the unseen questions over the days before the last one", () => {
    const p = weekPlan("2026-11-28", 100, 40, due, now); // 6 days left, 5 usable, 60 unseen
    expect(p.map((d) => d.kind)).toEqual([
      "study",
      "study",
      "study",
      "study",
      "study",
      "light",
      "exam",
    ]);
    expect(p[0]).toEqual({ day: "2026-11-22", kind: "study", fresh: 12, revise: 4 });
    expect(p[2]!.revise).toBe(2);
    // The day before the exam is for revision only; the exam day has nothing to do.
    expect(p[5]!.fresh).toBe(0);
    expect(p[6]).toEqual({ day: "2026-11-28", kind: "exam", fresh: 0, revise: 0 });
    // Twelve a day for five days covers the sixty not yet practised.
    expect(p.reduce((n, d) => n + d.fresh, 0)).toBe(60);
  });

  it("shows only seven days and stops at the exam when it is sooner", () => {
    expect(weekPlan("2026-12-30", 100, 0, due, now)).toHaveLength(7);
    const soon = weekPlan("2026-11-24", 30, 0, due, now);
    expect(soon.map((d) => d.kind)).toEqual(["study", "light", "exam"]);
    expect(soon[0]!.fresh).toBe(30); // one usable day: all of it
  });

  it("plans no new questions when everything has been practised", () => {
    const p = weekPlan("2026-11-26", 50, 50, [], now);
    expect(p.every((d) => d.fresh === 0)).toBe(true);
    expect(p.at(-1)!.kind).toBe("exam");
  });
});
