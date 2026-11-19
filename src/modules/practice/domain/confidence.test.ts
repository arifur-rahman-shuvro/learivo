import { describe, expect, it } from "vitest";
import { calibration, countCalibration } from "./confidence.ts";
import { applyFilter, type Past } from "./session.ts";
import { inGroup } from "./groups.ts";
import { byConfidence } from "../../workspace/domain/insights.ts";
import type { QuestionRecord } from "../../question-bank/data/repo.ts";

describe("calibration", () => {
  it("reads result and confidence together", () => {
    expect(calibration(true, "sure")).toBe("solid");
    expect(calibration(false, "sure")).toBe("overconfident");
    expect(calibration(true, "unsure")).toBe("shaky");
    expect(calibration(true, "guess")).toBe("shaky");
    expect(calibration(false, "guess")).toBe("gap");
    expect(calibration(true, null)).toBeNull();
  });

  it("counts only the answers that were rated", () => {
    const c = countCalibration([
      { correct: true, confidence: "sure" },
      { correct: false, confidence: "sure" },
      { correct: true, confidence: "guess" },
      { correct: false, confidence: null },
    ]);
    expect(c).toEqual({ rated: 3, solid: 1, overconfident: 1, shaky: 1, gap: 0 });
  });
});

describe("mistake groups", () => {
  const past = new Map<string, Past>([
    ["a", { last: "wrong", times: 1, reason: "careless", confidence: "sure" }],
    ["b", { last: "wrong", times: 2, reason: "not_known", confidence: "guess" }],
    ["c", { last: "correct", times: 1, confidence: "unsure" }],
    ["d", { last: "correct", times: 3, confidence: "sure" }],
  ]);
  const pool = ["a", "b", "c", "d", "e"].map((id) => ({ id }) as QuestionRecord);
  const ids = (f: Parameters<typeof applyFilter>[1]) => applyFilter(pool, f, past).map((q) => q.id);

  it("filters by what the student said went wrong", () => {
    expect(ids("incorrect")).toEqual(["a", "b"]);
    expect(ids("careless")).toEqual(["a"]);
    expect(ids("not_known")).toEqual(["b"]);
    expect(ids("mixed_up")).toEqual([]);
  });

  it("finds sure-but-wrong and right-but-unsure questions", () => {
    expect(ids("overconfident")).toEqual(["a"]);
    expect(ids("shaky")).toEqual(["c"]);
    expect(inGroup(undefined, "wrong")).toBe(false);
  });
});

describe("byConfidence", () => {
  it("gives accuracy at each level", () => {
    const f = (correct: boolean, confidence: "sure" | "unsure" | "guess") => ({
      at: "2026-11-19T00:00:00Z",
      path: [],
      correct,
      confidence,
    });
    const r = byConfidence([f(true, "sure"), f(false, "sure"), f(true, "guess")]);
    expect(r.rows.find((x) => x.confidence === "sure")).toMatchObject({
      answered: 2,
      accuracy: 0.5,
    });
    expect(r.rows.find((x) => x.confidence === "unsure")?.answered).toBe(0);
    expect(r.counts.overconfident).toBe(1);
  });
});
