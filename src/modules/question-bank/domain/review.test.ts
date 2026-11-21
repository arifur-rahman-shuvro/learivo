import { describe, expect, it } from "vitest";
import { qualityHints } from "./quality.ts";
import { allHints, reviewHints, summarise } from "./review.ts";
import { blankQuestion, type QuestionInput } from "./model.ts";

const q = (
  options: { text: string; correct: boolean }[],
  over: Partial<QuestionInput> = {},
): QuestionInput => ({
  ...blankQuestion("sba"),
  stem: "Which nerve supplies the deltoid muscle?",
  explanation: "The axillary nerve supplies the deltoid.",
  path: ["Anatomy"],
  answer: { options },
  ...over,
});
const ids = (x: QuestionInput) => reviewHints(x).map((h) => h.id);
const good = [
  { text: "Axillary nerve", correct: true },
  { text: "Radial nerve", correct: false },
  { text: "Ulnar nerve", correct: false },
];

describe("reviewHints", () => {
  it("has nothing to say about a sound question", () => {
    expect(ids(q(good))).toEqual([]);
  });

  it("flags a missing or doubled answer key as something to check", () => {
    const none = reviewHints(q(good.map((o) => ({ ...o, correct: false }))));
    expect(none.find((h) => h.id === "no-key")?.level).toBe("check");
    const two = reviewHints(q(good.map((o) => ({ ...o, correct: o.text !== "Ulnar nerve" }))));
    expect(two.find((h) => h.id === "many-keys")?.level).toBe("check");
  });

  it("allows several correct options in multi-select", () => {
    const m = q(
      good.map((o) => ({ ...o, correct: o.text !== "Ulnar nerve" })),
      { qtype: "multi_select" },
    );
    expect(ids(m)).not.toContain("many-keys");
  });

  it("catches an explanation that argues for another option", () => {
    const x = q(good, {
      explanation: "The radial nerve wraps around the humerus and supplies it.",
    });
    const h = reviewHints(x).find((v) => v.id === "explanation-other");
    expect(h?.level).toBe("check");
    expect(h?.message).toContain("Radial nerve");
  });

  it("accepts an explanation that names both the key and another option", () => {
    const x = q(good, {
      explanation: "Axillary, not radial nerve, supplies it. Radial nerve is for triceps.",
    });
    expect(ids(x)).not.toContain("explanation-other");
  });

  it("warns about negative wording unless it is capitalised", () => {
    expect(ids(q(good, { stem: "Which nerve does not supply the deltoid muscle?" }))).toContain(
      "negative-stem",
    );
    expect(ids(q(good, { stem: "Which nerve does NOT supply the deltoid muscle?" }))).not.toContain(
      "negative-stem",
    );
  });

  it("notes figures, dates and sources as facts to check", () => {
    expect(ids(q(good, { explanation: "Give 500 mg every 6 hours." }))).toContain("check-facts");
    expect(
      ids(q(good, { stem: "According to the 2019 guideline, which nerve supplies the deltoid?" })),
    ).toContain("check-facts");
    expect(ids(q(good))).not.toContain("check-facts");
  });

  it("notices two options only, an option inside another, and absolute words in the key", () => {
    expect(ids(q(good.slice(0, 2)))).toContain("few-options");
    const inside = q([
      { text: "Axillary nerve", correct: true },
      { text: "Axillary nerve and branches", correct: false },
      { text: "Ulnar nerve", correct: false },
    ]);
    expect(ids(inside)).toContain("option-inside-option");
    const abs = q([{ text: "It always acts alone", correct: true }, ...good.slice(1)]);
    expect(ids(abs)).toContain("absolute-key");
  });

  it("flags an empty fill-in-the-blank answer", () => {
    const x: QuestionInput = {
      ...blankQuestion("fill_blank"),
      stem: "The deltoid is supplied by the ___ nerve.",
      answer: { blanks: [{ accepted: [""] }] },
    };
    expect(ids(x)).toContain("blank-empty");
  });

  it("says nothing before there is a statement", () => {
    expect(ids(q(good, { stem: " " }))).toEqual([]);
  });
});

describe("summarise", () => {
  it("counts questions that need a look, tips only and clean ones", () => {
    const bad = allHints(q(good.map((o) => ({ ...o, correct: false }))), qualityHints(q(good)));
    const tip = allHints(q(good, { explanation: "" }), qualityHints(q(good, { explanation: "" })));
    const fine = allHints(q(good), qualityHints(q(good)));
    expect(summarise([bad, tip, fine])).toEqual({ total: 3, needLook: 1, tipsOnly: 1, clean: 1 });
  });
});
