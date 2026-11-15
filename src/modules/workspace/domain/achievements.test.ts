import { describe, expect, it } from "vitest";
import { achievements, longestStreak } from "./achievements.ts";
import type { Fact, SessionSummary } from "./insights.ts";

const fact = (at: string, correct = true): Fact => ({ at, path: ["A"], correct });
const session = (over: Partial<SessionSummary> = {}): SessionSummary => ({
  kind: "practice",
  title: "S",
  submittedAt: "2026-11-10T10:00:00",
  questionCount: 10,
  marksCorrect: 1,
  score: 10,
  secondsSpent: 60,
  answered: 10,
  correct: 10,
  ...over,
});
const get = (list: ReturnType<typeof achievements>, id: string) => list.find((a) => a.id === id)!;

describe("achievements", () => {
  it("starts with nothing earned", () => {
    const list = achievements([], []);
    expect(list.every((a) => !a.earned)).toBe(true);
    expect(get(list, "hundred")).toMatchObject({ current: 0, target: 100 });
  });

  it("counts answers and caps progress at the target", () => {
    const facts = Array.from({ length: 120 }, () => fact("2026-11-10T10:00:00"));
    const list = achievements(facts, []);
    expect(get(list, "first").earned).toBe(true);
    expect(get(list, "hundred")).toMatchObject({ earned: true, current: 100 });
    expect(get(list, "five-hundred")).toMatchObject({ earned: false, current: 120 });
  });

  it("finds the longest run of days, not just the current one", () => {
    const days = new Set(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-09"]);
    expect(longestStreak(days)).toBe(4);
    expect(longestStreak(new Set())).toBe(0);
    expect(longestStreak(new Set(["2026-12-31", "2027-01-01"]))).toBe(2);
    const list = achievements(
      [...days].map((d) => fact(`${d}T09:00:00`)),
      [],
    );
    expect(get(list, "streak-3").earned).toBe(true);
    expect(get(list, "streak-7").earned).toBe(false);
  });

  it("rewards exams and clean sessions", () => {
    const list = achievements(
      [],
      [
        session({ kind: "exam", questionCount: 10, score: 8.5 }),
        session({ answered: 12, correct: 12 }),
      ],
    );
    expect(get(list, "first-exam").earned).toBe(true);
    expect(get(list, "exam-80").earned).toBe(true);
    expect(get(list, "perfect").earned).toBe(true);
    const flawed = achievements([], [session({ answered: 12, correct: 11 })]);
    expect(get(flawed, "perfect").earned).toBe(false);
    const small = achievements([], [session({ answered: 5, correct: 5 })]);
    expect(get(small, "perfect").earned).toBe(false);
  });

  it("needs 100 answers before accuracy counts", () => {
    const few = achievements(
      Array.from({ length: 50 }, () => fact("2026-11-10T10:00:00")),
      [],
    );
    expect(get(few, "accuracy-80").earned).toBe(false);
    const many = achievements(
      Array.from({ length: 100 }, (_, i) => fact("2026-11-10T10:00:00", i < 85)),
      [],
    );
    expect(get(many, "accuracy-80").earned).toBe(true);
  });
});
