import { describe, expect, it } from "vitest";
import {
  NO_EXAM,
  cleanExamTarget,
  daysUntil,
  liveSubjects,
  paceFor,
  studyPlan,
} from "./examTarget.ts";

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
      subjectIds: [],
    });
  });
  it("keeps the chosen subjects once each and drops junk", () => {
    expect(
      cleanExamTarget({ date: "2026-12-01", subjectIds: ["a", "a", "", 3, "b"] }).subjectIds,
    ).toEqual(["a", "b"]);
    expect(cleanExamTarget({ date: "2026-12-01", subjectIds: "a" }).subjectIds).toEqual([]);
  });
  it("forgets subjects that no longer exist", () => {
    expect(liveSubjects(["a", "gone", "b"], ["a", "b", "c"])).toEqual(["a", "b"]);
    expect(liveSubjects(["gone"], ["a"])).toEqual([]);
  });
  it("works out a daily pace", () => {
    expect(paceFor(135, 10)).toBe(14);
    expect(paceFor(0, 10)).toBeNull();
    expect(paceFor(100, 0)).toBeNull();
  });
});

describe("study plan", () => {
  it("shares the unpractised questions over the days left", () => {
    expect(studyPlan(200, 50, 10)).toEqual({ unseen: 150, coverage: 25, perDay: 15 });
  });
  it("has nothing to schedule once everything is practised", () => {
    expect(studyPlan(40, 40, 5)).toEqual({ unseen: 0, coverage: 100, perDay: null });
  });
  it("keeps odd input in range", () => {
    expect(studyPlan(10, 99, 3).unseen).toBe(0);
    expect(studyPlan(10, -4, 3).unseen).toBe(10);
    expect(studyPlan(0, 0, 3).coverage).toBe(0);
  });
});
