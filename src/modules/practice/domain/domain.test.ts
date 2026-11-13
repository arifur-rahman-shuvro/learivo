import { describe, expect, it } from "vitest";
import { grade, isAnswered, marksFor, normalizeAnswer, tally } from "./grading.ts";
import { applyFilter, checkRules, drawByRules, mulberry32, shuffled } from "./session.ts";
import type { QuestionRecord } from "../../question-bank/data/repo.ts";
import { blankQuestion } from "../../question-bank/domain/model.ts";

const opts = {
  options: [
    { text: "A", correct: false },
    { text: "B", correct: true },
    { text: "C", correct: true },
  ],
};

describe("grade", () => {
  it("single choice: the one correct option", () => {
    const one = {
      options: [
        { text: "x", correct: false },
        { text: "y", correct: true },
      ],
    };
    expect(grade("sba", one, { choices: [1] })).toBe("correct");
    expect(grade("sba", one, { choices: [0] })).toBe("wrong");
    expect(grade("sba", one, { choices: [] })).toBe("unanswered");
    expect(grade("sba", one, null)).toBe("unanswered");
  });
  it("multi select needs exactly the right set", () => {
    expect(grade("multi_select", opts, { choices: [2, 1] })).toBe("correct");
    expect(grade("multi_select", opts, { choices: [1] })).toBe("wrong");
    expect(grade("multi_select", opts, { choices: [0, 1, 2] })).toBe("wrong");
  });
  it("true or false", () => {
    expect(grade("true_false", { answer: false }, { value: false })).toBe("correct");
    expect(grade("true_false", { answer: false }, { value: true })).toBe("wrong");
  });
  it("short answer ignores case, spacing and trailing punctuation", () => {
    const a = { accepted: ["Left  ventricle", "LV"] };
    expect(grade("short_answer", a, { text: " left ventricle. " })).toBe("correct");
    expect(grade("short_answer", a, { text: "lv" })).toBe("correct");
    expect(grade("short_answer", a, { text: "atrium" })).toBe("wrong");
    expect(grade("short_answer", a, { text: "   " })).toBe("unanswered");
  });
  it("fill in the blank needs every blank", () => {
    const a = { blanks: [{ accepted: ["aorta"] }, { accepted: ["vena cava", "IVC"] }] };
    expect(grade("fill_blank", a, { blanks: ["Aorta", "ivc"] })).toBe("correct");
    expect(grade("fill_blank", a, { blanks: ["Aorta", "x"] })).toBe("wrong");
    expect(grade("fill_blank", a, { blanks: ["", ""] })).toBe("unanswered");
  });
  it("a response of the wrong shape is wrong, not a crash", () => {
    expect(grade("true_false", { answer: true }, { text: "true" })).toBe("wrong");
  });
  it("normalizes answers", () => {
    expect(normalizeAnswer("  Aorta!! ")).toBe("aorta");
    expect(isAnswered({ blanks: ["", " "] })).toBe(false);
  });
});

describe("tally", () => {
  it("scores with negative marking and never goes below zero", () => {
    const t = tally(["correct", "wrong", "wrong", "unanswered"], 1, 0.25);
    expect(t).toMatchObject({ correct: 1, wrong: 2, unanswered: 1, score: 0.5, maxScore: 4 });
    expect(t.accuracy).toBeCloseTo(1 / 3);
    expect(tally(["wrong", "wrong"], 1, 1).score).toBe(0);
  });
  it("handles an attempt with no answers", () => {
    expect(tally(["unanswered"], 1, 0).accuracy).toBe(0);
  });
  it("marks per item", () => {
    expect(marksFor("correct", 2, 0.5)).toBe(2);
    expect(marksFor("wrong", 2, 0.5)).toBe(-0.5);
    expect(marksFor("unanswered", 2, 0.5)).toBe(0);
  });
});

function q(id: string, nodeId: string | null): QuestionRecord {
  return {
    ...blankQuestion("true_false"),
    answer: { answer: true },
    stem: id,
    id,
    nodeId,
    status: "active",
    version: 1,
    createdAt: "",
    updatedAt: "",
    tagIds: [],
    collectionIds: [],
  };
}
const inside = (n: string | null, x: QuestionRecord) => n === null || x.nodeId === n;

describe("session building", () => {
  it("shuffles repeatably with a seed and keeps every item", () => {
    const a = shuffled([1, 2, 3, 4, 5, 6], mulberry32(7));
    const b = shuffled([1, 2, 3, 4, 5, 6], mulberry32(7));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("filters unattempted and incorrect questions", () => {
    const pool = [q("a", null), q("b", null), q("c", null)];
    const past = new Map([
      ["a", { last: "correct" as const, times: 2 }],
      ["b", { last: "wrong" as const, times: 1 }],
    ]);
    expect(applyFilter(pool, "unattempted", past).map((x) => x.id)).toEqual(["c"]);
    expect(applyFilter(pool, "incorrect", past).map((x) => x.id)).toEqual(["b"]);
    expect(applyFilter(pool, "all", past)).toHaveLength(3);
  });
  it("warns when a rule cannot be met, counting earlier rules first", () => {
    const pool = [q("a", "x"), q("b", "x"), q("c", "y")];
    const checks = checkRules(
      [
        { nodeId: "x", count: 2 },
        { nodeId: null, count: 3 },
      ],
      pool,
      inside,
    );
    expect(checks[0]).toMatchObject({ available: 2, short: false });
    expect(checks[1]).toMatchObject({ available: 1, short: true });
  });
  it("draws by rules without repeats", () => {
    const pool = [q("a", "x"), q("b", "x"), q("c", "y")];
    const got = drawByRules(
      [
        { nodeId: "x", count: 1 },
        { nodeId: null, count: 5 },
      ],
      pool,
      inside,
      mulberry32(1),
    );
    expect(new Set(got.map((x) => x.id)).size).toBe(got.length);
    expect(got).toHaveLength(3);
  });
});
