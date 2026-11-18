import { describe, expect, it } from "vitest";
import { qualityHints } from "./quality.ts";
import { blankQuestion, type QuestionInput } from "./model.ts";

const q = (
  over: Partial<QuestionInput>,
  options: { text: string; correct: boolean }[],
): QuestionInput => ({
  ...blankQuestion("single_choice"),
  stem: "Which nerve supplies the deltoid muscle?",
  explanation: "Axillary nerve.",
  path: ["Anatomy"],
  answer: { options },
  ...over,
});
const ids = (x: QuestionInput) => qualityHints(x).map((h) => h.id);

describe("qualityHints", () => {
  const good = [
    { text: "Axillary", correct: true },
    { text: "Radial", correct: false },
    { text: "Ulnar", correct: false },
  ];
  it("has nothing to say about a well-made question", () => {
    expect(ids(q({}, good))).toEqual([]);
  });
  it("says nothing before there is a statement", () => {
    expect(ids(q({ stem: "  " }, good))).toEqual([]);
  });
  it("notices a missing explanation, subject and a very short statement", () => {
    expect(ids(q({ explanation: "", path: [], stem: "Deltoid nerve" }, good))).toEqual([
      "short-stem",
      "no-explanation",
      "no-subject",
    ]);
  });
  it("notices repeated options and 'all of the above'", () => {
    const got = ids(
      q({}, [
        { text: "Axillary", correct: true },
        { text: "axillary.", correct: false },
        { text: "All of the above", correct: false },
      ]),
    );
    expect(got).toContain("same-options");
    expect(got).toContain("all-above");
  });
  it("notices a correct answer far longer than the rest", () => {
    const got = ids(
      q({}, [
        {
          text: "The axillary nerve arising from the posterior cord of the brachial plexus",
          correct: true,
        },
        { text: "Radial", correct: false },
        { text: "Ulnar", correct: false },
      ]),
    );
    expect(got).toContain("long-answer");
  });
  it("notices a multi-select with one correct option", () => {
    expect(ids(q({ qtype: "multi_select" }, good))).toContain("multi-one");
  });
});
