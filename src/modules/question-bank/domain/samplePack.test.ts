import { describe, expect, it } from "vitest";
import { QUESTION_TYPES, validateQuestion } from "./model.ts";
import { SAMPLE_QUESTIONS, SAMPLE_TAG } from "./samplePack.ts";

describe("sample questions", () => {
  it("are twelve valid questions covering every question type, each tagged sample", () => {
    expect(SAMPLE_QUESTIONS).toHaveLength(12);
    for (const q of SAMPLE_QUESTIONS) {
      const r = validateQuestion(q);
      expect(r.ok, q.stem).toBe(true);
      expect(q.tags).toEqual([SAMPLE_TAG]);
      expect(q.explanation.length).toBeGreaterThan(20);
    }
    expect(new Set(SAMPLE_QUESTIONS.map((q) => q.qtype))).toEqual(new Set(QUESTION_TYPES));
    expect(new Set(SAMPLE_QUESTIONS.map((q) => q.stem)).size).toBe(12);
  });
});
