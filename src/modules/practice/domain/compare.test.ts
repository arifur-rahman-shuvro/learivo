import { describe, expect, it } from "vitest";
import { compareSentence, previousAttempt, type Scored } from "./compare.ts";

const at = (score: number, seconds: number, submittedAt: string | null): Scored => ({
  score,
  questionCount: 10,
  marksCorrect: 1,
  secondsSpent: seconds,
  submittedAt,
});

describe("previousAttempt", () => {
  it("picks the latest earlier finished attempt", () => {
    const a = at(5, 600, "2026-11-10T10:00:00Z");
    const b = at(6, 600, "2026-11-12T10:00:00Z");
    const now = at(8, 500, "2026-11-15T10:00:00Z");
    const later = at(9, 500, "2026-11-16T10:00:00Z");
    expect(previousAttempt(now, [a, b, now, later, at(1, 1, null)])).toBe(b);
    expect(previousAttempt(a, [a])).toBeNull();
  });
});

describe("compareSentence", () => {
  it("reports score and time change", () => {
    expect(compareSentence(at(8, 500, "x"), at(6, 620, "y"))).toBe(
      "Up 20 points from last time, and 2 min faster.",
    );
    expect(compareSentence(at(5, 500, "x"), at(6, 500, "y"))).toBe(
      "Down 10 points from last time.",
    );
    expect(compareSentence(at(6, 510, "x"), at(6, 500, "y"))).toBe("Same score as last time.");
  });
});
