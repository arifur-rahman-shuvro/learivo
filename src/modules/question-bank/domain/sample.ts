import { blankQuestion, type QuestionInput } from "./model.ts";

const opts = (items: [string, boolean][]) => ({
  options: items.map(([text, correct]) => ({ text, correct })),
});

const base = (q: Partial<QuestionInput> & Pick<QuestionInput, "qtype" | "stem" | "answer">) => ({
  ...blankQuestion(q.qtype),
  ...q,
  path: ["Sample"],
  tags: ["sample"],
});

/** A few ready questions so a new student can try practice and an exam before adding their own. */
export const SAMPLE_QUESTIONS: QuestionInput[] = [
  base({
    qtype: "sba",
    stem: "Which organ pumps blood around the human body?",
    answer: opts([
      ["Liver", false],
      ["Heart", true],
      ["Kidney", false],
      ["Lung", false],
    ]),
    explanation: "The heart is a muscular pump. It pushes blood through the blood vessels.",
    difficulty: 1,
  }),
  base({
    qtype: "multi_select",
    stem: "Which of these are prime numbers?",
    answer: opts([
      ["2", true],
      ["9", false],
      ["11", true],
      ["15", false],
    ]),
    explanation: "A prime has exactly two factors. 9 = 3 x 3 and 15 = 3 x 5.",
    difficulty: 2,
  }),
  base({
    qtype: "true_false",
    stem: "About water:",
    answer: opts([
      ["It boils at 100 degrees Celsius at sea level.", true],
      ["It is made of one hydrogen and two oxygen atoms.", false],
      ["Ice is denser than liquid water.", false],
    ]),
    explanation: "Water is H2O: two hydrogen and one oxygen. Ice floats, so it is less dense.",
    difficulty: 2,
  }),
  base({
    qtype: "fill_blank",
    stem: "Plants make food from sunlight in a process called {{1}}.",
    answer: { blanks: [{ accepted: ["photosynthesis"] }] },
    explanation: "Photosynthesis turns light, water and carbon dioxide into sugar and oxygen.",
    difficulty: 1,
  }),
  base({
    qtype: "sba",
    stem: "A shop gives 20% off a 500 taka item. What is the sale price?",
    answer: opts([
      ["300 taka", false],
      ["380 taka", false],
      ["400 taka", true],
      ["450 taka", false],
    ]),
    explanation: "20% of 500 is 100, so the price is 500 - 100 = 400 taka.",
    difficulty: 2,
  }),
];
