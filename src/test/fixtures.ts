import type { AnswerSpec } from "../modules/question-bank/domain/model.ts";

/** A valid true/false answer: five statements, keys T F T F F. */
export const TF_ANSWER: AnswerSpec = {
  options: [
    { text: "Statement 1", correct: true },
    { text: "Statement 2", correct: false },
    { text: "Statement 3", correct: true },
    { text: "Statement 4", correct: false },
    { text: "Statement 5", correct: false },
  ],
};
