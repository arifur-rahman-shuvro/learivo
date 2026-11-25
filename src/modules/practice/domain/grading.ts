import type { AnswerSpec, QuestionType } from "../../question-bank/domain/model.ts";

/** What a student answered. Which field is used depends on the question type. */
export type Response =
  | { choices: number[] } // sba, single_choice, multi_select: indexes into the options shown
  | { marks: (boolean | null)[] } // true_false: for each statement true, false, or null if not answered
  | { blanks: string[] }; // fill_blank

/** correct: full marks. partial: some of the marks. wrong: none. unanswered: left blank. */
export type Verdict = "correct" | "partial" | "wrong" | "unanswered";

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
  if ("marks" in r) return r.marks.some((m) => typeof m === "boolean");
  return r.blanks.some((b) => b.trim() !== "");
}

/** How one question went. credit and penalty are fractions of the question's marks (0 to 1). */
export interface Outcome {
  verdict: Verdict;
  /** Share of the question's marks earned. */
  credit: number;
  /** Share of the negative marking that applies. */
  penalty: number;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;
const NONE: Outcome = { verdict: "unanswered", credit: 0, penalty: 0 };

function outcome(credit: number, penalty: number): Outcome {
  const c = round4(Math.min(1, Math.max(0, credit)));
  return {
    verdict: c >= 1 ? "correct" : c > 0 ? "partial" : "wrong",
    credit: c,
    penalty: round4(Math.min(1, penalty)),
  };
}

/**
 * Marks one response.
 *
 * - Single answer: all or nothing.
 * - Multiple answers, k of them correct: each correct pick earns 1/k, and each wrong pick takes
 *   1/k away (never below zero), so ticking everything earns nothing.
 * - True or false, one mark spread over the statements (an equal share each, 0.2 for five): each statement that
 *   is marked correctly earns its share. A statement left unmarked earns nothing and loses nothing.
 * - Fill in the blank: every blank must be right.
 *
 * Negative marking (set per exam) applies to the same units: a wrong single answer, each wrong
 * pick in multiple answer (1/k), and each wrong statement in true or false.
 */
export function grade(
  qtype: QuestionType,
  answer: AnswerSpec,
  response: Response | null | undefined,
): Outcome {
  if (!isAnswered(response)) return NONE;
  const r = response!;

  if ("options" in answer && "choices" in r && qtype !== "true_false") {
    const right = new Set(answer.options.flatMap((o, i) => (o.correct ? [i] : [])));
    const given = [...new Set(r.choices)];
    if (qtype === "multi_select") {
      const k = right.size;
      const good = given.filter((i) => right.has(i)).length;
      const bad = given.length - good;
      return outcome((good - bad) / k, bad / k);
    }
    const ok = given.length === 1 && right.has(given[0]!);
    return outcome(ok ? 1 : 0, ok ? 0 : 1);
  }

  if ("options" in answer && "marks" in r && qtype === "true_false") {
    const n = answer.options.length;
    let good = 0;
    let bad = 0;
    answer.options.forEach((o, i) => {
      const m = r.marks[i];
      if (typeof m !== "boolean") return;
      if (m === o.correct) good++;
      else bad++;
    });
    return outcome(good / n, bad / n);
  }

  if ("blanks" in answer && "blanks" in r) {
    const ok = answer.blanks.every((b, i) => matches(r.blanks[i] ?? "", b.accepted));
    return outcome(ok ? 1 : 0, ok ? 0 : 1);
  }
  return outcome(0, 1);
}

export interface Tally {
  correct: number;
  partial: number;
  wrong: number;
  unanswered: number;
  /** Never below zero: negative marking cannot take a student under 0. */
  score: number;
  maxScore: number;
  /** Share of the answered questions' marks that were earned (0 to 1). */
  accuracy: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Marks for display: at most two decimals (13.3333 shows as 13.33, 13.25 stays 13.25, 15 stays 15). */
export function formatMarks(n: number | null | undefined): string {
  const v = Math.round((n ?? 0) * 100) / 100;
  return String(Object.is(v, -0) ? 0 : v);
}

/**
 * Percentage of everything the session was worth: marks earned out of the marks for ALL the
 * questions, so skipped questions count against it. 12 right of 20 is 60%, even if only 16 were
 * answered. Returns 0 to 100, one decimal at most.
 */
export function percentOfTotal(
  score: number | null | undefined,
  count: number,
  marksEach: number,
): number {
  const max = count * marksEach;
  if (max <= 0) return 0;
  const p = ((score ?? 0) / max) * 100;
  return Math.round(Math.min(100, Math.max(0, p)) * 10) / 10;
}

/** Marks earned by one question, before the total is kept above zero. */
export function marksFor(o: Outcome, marksCorrect: number, marksWrong: number): number {
  return round2(o.credit * marksCorrect - o.penalty * marksWrong);
}

export function tally(
  outcomes: readonly Outcome[],
  marksCorrect: number,
  marksWrong: number,
): Tally {
  const count = (v: Verdict) => outcomes.filter((o) => o.verdict === v).length;
  const raw = outcomes.reduce(
    (sum, o) => sum + o.credit * marksCorrect - o.penalty * marksWrong,
    0,
  );
  const answered = outcomes.filter((o) => o.verdict !== "unanswered");
  return {
    correct: count("correct"),
    partial: count("partial"),
    wrong: count("wrong"),
    unanswered: count("unanswered"),
    score: Math.max(0, round2(raw)),
    maxScore: round2(outcomes.length * marksCorrect),
    accuracy:
      answered.length === 0 ? 0 : answered.reduce((s, o) => s + o.credit, 0) / answered.length,
  };
}
