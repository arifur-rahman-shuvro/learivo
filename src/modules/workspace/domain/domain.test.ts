import { describe, expect, it } from "vitest";
import {
  RATINGS,
  RELEARN_MINUTES,
  describeInterval,
  intervalDays,
  isDue,
  newCard,
  preview,
  retrievability,
  review,
} from "./scheduler.ts";
import {
  accuracyByDay,
  activeDaySet,
  answeredOn,
  byArea,
  dayKey,
  examHistory,
  overall,
  streak,
  studyTimeByDay,
  weakAreas,
  type Fact,
  type SessionSummary,
} from "./insights.ts";

const T0 = new Date("2026-11-13T09:00:00");
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

describe("scheduler", () => {
  it("a new card is due now", () => {
    expect(isDue(newCard(T0), T0)).toBe(true);
  });

  it("recall chance is 90% at the stability and falls over time", () => {
    expect(retrievability(0, 5)).toBe(1);
    expect(retrievability(5, 5)).toBeCloseTo(0.9, 2);
    expect(retrievability(20, 5)).toBeLessThan(retrievability(5, 5));
  });

  it("first review: intervals rise from Hard to Good to Easy", () => {
    const p = preview(newCard(T0), T0);
    expect("days" in p[2] && "days" in p[3] && "days" in p[4]).toBe(true);
    const [h, g, e] = [p[2], p[3], p[4]].map((x) => ("days" in x ? x.days : -1)) as number[];
    expect(h).toBeGreaterThanOrEqual(1);
    expect(g!).toBeGreaterThan(h!);
    expect(e!).toBeGreaterThan(g!);
    // Published default for a first "Good" is about 3 to 4 days.
    expect(g).toBeGreaterThanOrEqual(3);
    expect(g).toBeLessThanOrEqual(4);
  });

  it("Again brings the card back in minutes and counts a lapse only for a card already learned", () => {
    const first = review(newCard(T0), 1, T0);
    expect(new Date(first.due).getTime() - T0.getTime()).toBe(RELEARN_MINUTES * 60_000);
    expect(first.lapses).toBe(0);
    const learned = review(newCard(T0), 3, T0);
    const lapsed = review(learned, 1, plusDays(T0, 4));
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.stability).toBeLessThan(learned.stability);
  });

  it("a card answered well several times is spaced further and further apart", () => {
    let card = newCard(T0);
    let now = T0;
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) {
      card = review(card, 3, now);
      const gap = Math.round((new Date(card.due).getTime() - now.getTime()) / 86_400_000);
      gaps.push(gap);
      now = new Date(card.due);
    }
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeGreaterThan(gaps[i - 1]!);
  });

  it("Easy lowers difficulty and Hard raises it, always within 1 to 10", () => {
    const base = review(newCard(T0), 3, T0);
    const later = plusDays(T0, 3);
    expect(review(base, 4, later).difficulty).toBeLessThan(base.difficulty);
    expect(review(base, 2, later).difficulty).toBeGreaterThan(base.difficulty);
    let c = base;
    for (let i = 0; i < 30; i++) c = review(c, 1, plusDays(T0, i));
    expect(c.difficulty).toBeLessThanOrEqual(10);
    expect(c.difficulty).toBeGreaterThanOrEqual(1);
  });

  it("reviewing a card late earns a bigger gain than reviewing it early", () => {
    const base = review(newCard(T0), 3, T0);
    const early = review(base, 3, plusDays(T0, 1));
    const late = review(base, 3, plusDays(T0, 10));
    expect(late.stability).toBeGreaterThan(early.stability);
  });

  it("never schedules less than a day for a pass, and the card is not due before its time", () => {
    for (const r of RATINGS.filter((x) => x > 1)) {
      const next = review(newCard(T0), r, T0);
      expect(isDue(next, T0)).toBe(false);
      expect(intervalDays(0.01)).toBe(1);
    }
  });

  it("describes intervals for the buttons", () => {
    expect(describeInterval({ minutes: 10 })).toBe("10 min");
    expect(describeInterval({ days: 1 })).toBe("1 day");
    expect(describeInterval({ days: 4 })).toBe("4 days");
    expect(describeInterval({ days: 90 })).toBe("3 mo");
  });
});

const fact = (day: string, path: string[], correct: boolean): Fact => ({
  at: `${day}T10:00:00`,
  path,
  correct,
});

describe("insights", () => {
  it("accuracy by subject, weakest first, and Unclassified for no subject", () => {
    const facts = [
      fact("2026-11-13", ["Anatomy"], true),
      fact("2026-11-13", ["Anatomy"], false),
      fact("2026-11-13", ["Physiology"], true),
      fact("2026-11-13", [], false),
    ];
    const rows = byArea(facts);
    expect(rows.map((r) => r.name)).toEqual(["Unclassified", "Anatomy", "Physiology"]);
    expect(rows[1]).toMatchObject({ correct: 1, total: 2, accuracy: 0.5 });
  });

  it("weak areas need enough answers and low accuracy", () => {
    const facts = [
      ...Array.from({ length: 5 }, (_, i) => fact("2026-11-13", ["A", "Heart"], i === 0)),
      ...Array.from({ length: 5 }, () => fact("2026-11-13", ["A", "Lung"], true)),
      ...Array.from({ length: 2 }, () => fact("2026-11-13", ["B", "X"], false)),
    ];
    expect(weakAreas(facts).map((a) => a.name)).toEqual(["A › Heart"]);
  });

  it("streak counts consecutive days and survives until the end of today", () => {
    const days = new Set(["2026-11-13", "2026-11-12", "2026-11-11", "2026-11-09"]);
    expect(streak(days, new Date("2026-11-13T20:00:00"))).toBe(3);
    // Nothing yet today: yesterday's streak is still alive.
    expect(streak(new Set(["2026-11-12", "2026-11-11"]), new Date("2026-11-13T08:00:00"))).toBe(2);
    // Missed a whole day: streak is gone.
    expect(streak(new Set(["2026-11-10"]), new Date("2026-11-13T08:00:00"))).toBe(0);
    expect(streak(new Set(), T0)).toBe(0);
  });

  it("works across a month end", () => {
    const days = new Set(["2026-11-01", "2026-10-31", "2026-10-30"]);
    expect(streak(days, new Date("2026-11-01T12:00:00"))).toBe(3);
  });

  it("daily accuracy keeps only the last N days, oldest first", () => {
    const facts = [
      fact("2026-11-13", ["A"], true),
      fact("2026-11-13", ["A"], false),
      fact("2026-11-01", ["A"], true),
      fact("2026-09-01", ["A"], true),
    ];
    const pts = accuracyByDay(facts, T0, 30);
    expect(pts.map((p) => p.day)).toEqual(["2026-11-01", "2026-11-13"]);
    expect(pts[1]).toMatchObject({ answered: 2, accuracy: 0.5 });
    expect(answeredOn(facts, T0)).toBe(2);
  });

  const session = (over: Partial<SessionSummary>): SessionSummary => ({
    kind: "exam",
    title: "Mock",
    submittedAt: "2026-11-13T10:00:00",
    questionCount: 10,
    marksCorrect: 1,
    score: 7.5,
    secondsSpent: 600,
    answered: 10,
    correct: 8,
    ...over,
  });

  it("exam history as percent of full marks, oldest first, and ignores practice", () => {
    const rows = examHistory([
      session({ submittedAt: "2026-11-13T10:00:00", score: 9 }),
      session({ submittedAt: "2026-11-10T10:00:00", score: 5 }),
      session({ kind: "practice" }),
    ]);
    expect(rows.map((r) => r.percent)).toEqual([50, 90]);
  });

  it("study time per day fills empty days with zero", () => {
    const rows = studyTimeByDay(
      [session({ secondsSpent: 300 }), session({ secondsSpent: 120 })],
      T0,
      3,
    );
    expect(rows).toEqual([
      { day: "2026-11-11", seconds: 0 },
      { day: "2026-11-12", seconds: 0 },
      { day: "2026-11-13", seconds: 420 },
    ]);
  });

  it("active days combine answers and sessions; overall handles no data", () => {
    expect([...activeDaySet([session({})], [fact("2026-11-12", [], true)])].sort()).toEqual([
      "2026-11-12",
      "2026-11-13",
    ]);
    expect(overall([]).accuracy).toBeNull();
    expect(overall([fact("2026-11-13", [], true), fact("2026-11-13", [], false)]).accuracy).toBe(
      0.5,
    );
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
