import type { AnswerSpec, QuestionType } from "../../question-bank/domain/model.ts";

/** What a student answered. Which field is used depends on the question type. */
export type Response =
  | { choices: number[] } // sba, single_choice, multi_select: indexes into the options shown
  | { value: boolean } // true_false
  | { text: string } // short_answer
  | { blanks: string[] }; // fill_blank

export type Verdict = "correct" | "wrong" | "unanswered";

/** A frozen copy of a question, taken when it was drawn into a session or exam. */
export interface Snapshot {
  qtype: QuestionType;
  stem: string;
  explanation: string;
  /** For option types the options are already in the order the student saw them. */
  answer: AnswerSpec;
  difficulty: number | null;
  /** Subject down to subtopic, for the breakdown by subject. */
  path: string[];
}

/** Lower-case, collapse spaces, drop trailing punctuation: "Aorta. " matches "aorta". */
export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?,;:]+$/u, "")
    .trim();
}

const matches = (given: string, accepted: readonly string[]) => {
  const g = normalizeAnswer(given);
  return g !== "" && accepted.some((a) => normalizeAnswer(a) === g);
};

export function isAnswered(r: Response | null | undefined): boolean {
  if (!r) return false;
  if ("choices" in r) return r.choices.length > 0;
  if ("value" in r) return typeof r.value === "boolean";
  if ("text" in r) return r.text.trim() !== "";
  return r.blanks.some((b) => b.trim() !== "");
}

/** Marks one response. Multiple select needs exactly the right set; fill-blank needs every blank. */
export function grade(
  qtype: QuestionType,
  answer: AnswerSpec,
  response: Response | null | undefined,
): Verdict {
  if (!isAnswered(response)) return "unanswered";
  const r = response!;
  const ok = (() => {
    if ("options" in answer && "choices" in r) {
      const right = answer.options.flatMap((o, i) => (o.correct ? [i] : []));
      const given = [...new Set(r.choices)].sort((a, b) => a - b);
      if (qtype === "multi_select") {
        return right.length === given.length && right.every((x, i) => x === given[i]);
      }
      return given.length === 1 && right.includes(given[0]!);
    }
    if ("answer" in answer && "value" in r) return answer.answer === r.value;
    if ("accepted" in answer && "text" in r) return matches(r.text, answer.accepted);
    if ("blanks" in answer && "blanks" in r) {
      return answer.blanks.every((b, i) => matches(r.blanks[i] ?? "", b.accepted));
    }
    return false;
  })();
  return ok ? "correct" : "wrong";
}

export interface Tally {
  correct: number;
  wrong: number;
  unanswered: number;
  /** Never below zero: negative marking cannot take a student under 0. */
  score: number;
  maxScore: number;
  accuracy: number;
}

export function tally(
  verdicts: readonly Verdict[],
  marksCorrect: number,
  marksWrong: number,
): Tally {
  const correct = verdicts.filter((v) => v === "correct").length;
  const wrong = verdicts.filter((v) => v === "wrong").length;
  const unanswered = verdicts.length - correct - wrong;
  const raw = correct * marksCorrect - wrong * marksWrong;
  const answered = correct + wrong;
  return {
    correct,
    wrong,
    unanswered,
    score: Math.max(0, Math.round(raw * 100) / 100),
    maxScore: Math.round(verdicts.length * marksCorrect * 100) / 100,
    accuracy: answered === 0 ? 0 : correct / answered,
  };
}

/** Marks earned by one item, for the results list. */
export function marksFor(v: Verdict, marksCorrect: number, marksWrong: number): number {
  return v === "correct" ? marksCorrect : v === "wrong" ? -marksWrong : 0;
}
