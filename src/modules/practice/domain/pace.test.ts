import { describe, expect, it } from "vitest";
import { paceNote, paceOf, shortTime, type PaceItem } from "./pace.ts";

const item = (position: number, seconds: number, verdict: PaceItem["verdict"]): PaceItem => ({
  position,
  seconds,
  verdict,
});

describe("paceOf", () => {
  it("is null when no time was recorded", () => {
    expect(paceOf([item(0, 0, "correct")])).toBeNull();
    expect(paceOf([])).toBeNull();
  });
  it("finds average, median and the clearly slow questions", () => {
    const p = paceOf([
      item(0, 10, "correct"),
      item(1, 12, "correct"),
      item(2, 11, "wrong"),
      item(3, 90, "wrong"),
    ])!;
    expect(p.timed).toBe(4);
    expect(p.median).toBe(11.5);
    expect(Math.round(p.average)).toBe(31);
    expect(p.slowest).toEqual([{ position: 3, seconds: 90 }]);
  });
  it("compares right and wrong only with two of each", () => {
    expect(paceOf([item(0, 10, "correct"), item(1, 40, "wrong")])!.rightAverage).toBeNull();
    const p = paceOf([
      item(0, 10, "correct"),
      item(1, 10, "correct"),
      item(2, 40, "wrong"),
      item(3, 50, "wrong"),
    ])!;
    expect(p.rightAverage).toBe(10);
    expect(p.wrongAverage).toBe(45);
    expect(paceNote(p)).toMatch(/longer on the questions you got wrong/);
  });
  it("notices rushed wrong answers", () => {
    const p = paceOf([
      item(0, 30, "correct"),
      item(1, 30, "correct"),
      item(2, 3, "wrong"),
      item(3, 4, "wrong"),
    ])!;
    expect(p.rushedWrong).toBe(2);
    expect(paceNote(p)).toMatch(/Slow down/);
  });
});

describe("shortTime", () => {
  it("reads naturally", () => {
    expect(shortTime(45)).toBe("45 s");
    expect(shortTime(60)).toBe("1 min");
    expect(shortTime(65)).toBe("1 min 5 s");
  });
});
