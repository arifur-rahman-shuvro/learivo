import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  fromRow,
  hourLabel,
  hourToTime,
  previewFor,
  studyTimeIsQuiet,
  toRow,
  usualHour,
} from "./settings.ts";

const at = (h: number, day = 1) => new Date(2026, 10, day, h, 5).toISOString();

describe("notification settings", () => {
  it("starts off, with sensible defaults", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      enabled: false,
      tone: "mix",
      maxPerDay: 2,
      studyTime: "18:00",
    });
  });
  it("converts to and from the database row, trimming seconds and keeping only switched-off kinds", () => {
    const s = fromRow({
      enabled: true,
      tone: "funny",
      study_time: "19:30:00",
      quiet_start: "23:00:00",
      quiet_end: "06:00:00",
      kinds: { revision: false, daily: true, weird: 3 },
      max_per_day: 3,
    });
    expect(s).toEqual({
      enabled: true,
      tone: "funny",
      studyTime: "19:30",
      quietStart: "23:00",
      quietEnd: "06:00",
      kinds: { revision: false },
      maxPerDay: 3,
    });
    expect(toRow(s)).toMatchObject({
      study_time: "19:30",
      quiet_start: "23:00",
      max_per_day: 3,
      kinds: { revision: false },
    });
    expect(fromRow(null)).toEqual(DEFAULT_SETTINGS);
    expect(fromRow({ ...toRow(DEFAULT_SETTINGS), tone: "rude" }).tone).toBe("mix");
  });
  it("finds the hour the student usually studies, needing at least three sessions", () => {
    expect(usualHour([at(18, 1), at(18, 2), at(18, 3), at(7, 4)])).toBe(18);
    expect(usualHour([at(18, 1), at(18, 2), at(7, 3)])).toBeNull();
    expect(
      usualHour([at(7, 1), at(7, 2), at(7, 3), at(21, 4), at(21, 5), at(21, 6), at(21, 7)]),
    ).toBe(21);
    expect(usualHour(["nonsense"])).toBeNull();
    expect(usualHour([])).toBeNull();
  });
  it("formats hours", () => {
    expect(hourToTime(7)).toBe("07:00");
    expect(hourLabel(0)).toBe("12 am");
    expect(hourLabel(12)).toBe("12 pm");
    expect(hourLabel(18)).toBe("6 pm");
  });
  it("warns when the study time is inside quiet hours, including overnight ranges", () => {
    expect(studyTimeIsQuiet({ studyTime: "23:00", quietStart: "22:00", quietEnd: "07:00" })).toBe(
      true,
    );
    expect(studyTimeIsQuiet({ studyTime: "05:00", quietStart: "22:00", quietEnd: "07:00" })).toBe(
      true,
    );
    expect(studyTimeIsQuiet({ studyTime: "18:00", quietStart: "22:00", quietEnd: "07:00" })).toBe(
      false,
    );
    expect(studyTimeIsQuiet({ studyTime: "13:00", quietStart: "12:00", quietEnd: "14:00" })).toBe(
      true,
    );
  });
  it("shows an example in the chosen voice", () => {
    const p = previewFor("firm", 0);
    expect(p.title.length).toBeGreaterThan(3);
    expect(p.body + p.title).not.toMatch(/[{}]/);
  });
});
