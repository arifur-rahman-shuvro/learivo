import { describe, expect, it } from "vitest";
import { cardFromSnapshot, newAutoCards } from "./autoCards.ts";
import type { Snapshot } from "./grading.ts";

const snap = (over: Partial<Snapshot>): Snapshot => ({
  qtype: "sba",
  stem: "Which nerve is compressed in carpal tunnel syndrome?",
  explanation: "It runs through the carpal tunnel.",
  answer: {
    options: [
      { text: "Ulnar", correct: false },
      { text: "Median", correct: true },
    ],
  },
  difficulty: null,
  path: [],
  ...over,
});

describe("flashcards made from missed or skipped questions", () => {
  it("single answer: question on the front, answer and explanation on the back", () => {
    expect(cardFromSnapshot(snap({}))).toEqual({
      front: "Which nerve is compressed in carpal tunnel syndrome?",
      back: "Answer: Median\n\nIt runs through the carpal tunnel.",
    });
  });

  it("multiple select lists every right option", () => {
    const c = cardFromSnapshot(
      snap({
        qtype: "multi_select",
        explanation: "",
        answer: {
          options: [
            { text: "A", correct: true },
            { text: "B", correct: false },
            { text: "C", correct: true },
          ],
        },
      }),
    );
    expect(c.back).toBe("Answers:\n- A\n- C");
  });

  it("true/false puts the statements on the front and the truth of each on the back", () => {
    const c = cardFromSnapshot(
      snap({
        qtype: "true_false",
        stem: "About the heart:",
        explanation: "",
        answer: {
          options: [
            { text: "Mitral has two cusps", correct: true },
            { text: "SA node is in the left atrium", correct: false },
          ],
        },
      }),
    );
    expect(c.front).toBe(
      "About the heart:\n1. Mitral has two cusps\n2. SA node is in the left atrium",
    );
    expect(c.back).toBe("1. True\n2. False");
  });

  it("fill in the blank hides the blanks and gives the accepted answers", () => {
    const c = cardFromSnapshot(
      snap({
        qtype: "fill_blank",
        stem: "Okazaki fragments are joined by DNA {{1}}.",
        explanation: "",
        answer: { blanks: [{ accepted: ["ligase"] }] },
      }),
    );
    expect(c.front).toBe("Okazaki fragments are joined by DNA _____.");
    expect(c.back).toBe("Answer: ligase");
  });

  it("skips questions that already have a card and repeats within one batch", () => {
    const a = snap({});
    const b = snap({ stem: "Another question" });
    expect(newAutoCards([a, a, b], new Set([a.stem])).map((c) => c.front)).toEqual([
      "Another question",
    ]);
    expect(newAutoCards([a, a], new Set())).toHaveLength(1);
  });

  it("keeps long questions inside the card limits", () => {
    const c = cardFromSnapshot(snap({ stem: "x".repeat(5000), explanation: "y".repeat(9000) }));
    expect(c.front.length).toBeLessThanOrEqual(2000);
    expect(c.back.length).toBeLessThanOrEqual(5000);
  });
});
