import { describe, expect, it } from "vitest";
import { NO_EXAM, cleanExamTarget, daysUntil, paceFor } from "./examTarget.ts";

describe("exam countdown", () => {
  const now = new Date(2026, 10, 15, 23, 30); // 15 Nov 2026, late evening
  it("counts whole calendar days, whatever the time of day", () => {
    expect(daysUntil("2026-11-15", now)).toBe(0);
    expect(daysUntil("2026-11-16", now)).toBe(1);
    expect(daysUntil("2026-12-25", now)).toBe(40);
    expect(daysUntil("2026-11-10", now)).toBe(-5);
    expect(daysUntil("2027-03-01", now)).toBe(106);
  });
  it("rejects badly formed dates", () => {
    expect(daysUntil("tomorrow", now)).toBeNaN();
    expect(cleanExamTarget({ title: "x", date: "15/11/2026" })).toEqual(NO_EXAM);
    expect(cleanExamTarget(null)).toEqual(NO_EXAM);
  });
  it("trims and keeps a valid target", () => {
    expect(cleanExamTarget({ title: "  Final  ", date: "2026-12-01" })).toEqual({
      title: "Final",
      date: "2026-12-01",
    });
  });
  it("works out a daily pace", () => {
    expect(paceFor(135, 10)).toBe(14);
    expect(paceFor(0, 10)).toBeNull();
    expect(paceFor(100, 0)).toBeNull();
  });
});
