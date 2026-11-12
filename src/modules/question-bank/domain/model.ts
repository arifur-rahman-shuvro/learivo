import { z } from "zod";

export const QUESTION_TYPES = [
  "sba",
  "single_choice",
  "multi_select",
  "true_false",
  "short_answer",
  "fill_blank",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const TYPE_LABELS: Record<QuestionType, string> = {
  sba: "Single best answer",
  single_choice: "Single choice",
  multi_select: "Multiple select",
  true_false: "True or false",
  short_answer: "Short answer",
  fill_blank: "Fill in the blank",
};

export const TAXONOMY_KINDS = ["subject", "chapter", "topic", "subtopic"] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

export interface Option {
  text: string;
  correct: boolean;
}

/** The stored shape of an answer. Which fields exist depends on the question type. */
export type AnswerSpec =
  | { options: Option[] } // sba, single_choice, multi_select
  | { answer: boolean } // true_false
  | { accepted: string[] } // short_answer
  | { blanks: { accepted: string[] }[] }; // fill_blank

export const MAX_OPTIONS = 10;
export const BLANK_PATTERN = /\{\{\d+\}\}/g;

/** A question as the app creates, edits, imports and exports it. */
export interface QuestionInput {
  qtype: QuestionType;
  stem: string;
  explanation: string;
  answer: AnswerSpec;
  difficulty: number | null;
  source: string;
  institution: string;
  examName: string;
  examYear: number | null;
  /** Names from subject down to subtopic, for example ["Anatomy", "Thorax"]. */
  path: string[];
  tags: string[];
}

export interface Issue {
  field: string;
  message: string;
}

const text = (max: number) => z.string().trim().max(max);

const shape = z.object({
  qtype: z.enum(QUESTION_TYPES, { error: "Choose a question type." }),
  stem: z.string().trim().min(1, "Write the question.").max(10000, "The question is too long."),
  explanation: z.string().max(10000, "The explanation is too long.").default(""),
  difficulty: z.number().int().min(1).max(5).nullable().default(null),
  source: text(200).default(""),
  institution: text(200).default(""),
  examName: text(200).default(""),
  examYear: z.number().int().min(1900).max(2100).nullable().default(null),
  path: z.array(z.string().trim().min(1).max(120)).max(4).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
});

const nonEmpty = (s: string) => s.trim().length > 0;

/** Checks the answer against the question type. Returns plain-language problems. */
export function answerIssues(qtype: QuestionType, stem: string, answer: unknown): Issue[] {
  const a = (answer ?? {}) as Record<string, unknown>;
  const issues: Issue[] = [];
  const bad = (message: string) => issues.push({ field: "answer", message });

  if (qtype === "sba" || qtype === "single_choice" || qtype === "multi_select") {
    const options = Array.isArray(a.options) ? (a.options as Partial<Option>[]) : [];
    if (options.length < 2) bad("Add at least 2 options.");
    else if (options.length > MAX_OPTIONS) bad(`Use at most ${MAX_OPTIONS} options.`);
    else if (options.some((o) => typeof o.text !== "string" || !nonEmpty(o.text)))
      bad("Every option needs text.");
    const correct = options.filter((o) => o.correct === true).length;
    if (qtype === "multi_select") {
      if (options.length >= 2 && correct < 1) bad("Mark at least one correct option.");
    } else if (options.length >= 2 && correct !== 1) {
      bad("Mark exactly one correct option.");
    }
  } else if (qtype === "true_false") {
    if (typeof a.answer !== "boolean") bad("Choose true or false.");
  } else if (qtype === "short_answer") {
    const accepted = Array.isArray(a.accepted) ? (a.accepted as unknown[]) : [];
    if (accepted.length < 1 || accepted.length > 20) bad("Add 1 to 20 accepted answers.");
    else if (accepted.some((x) => typeof x !== "string" || !nonEmpty(x)))
      bad("Accepted answers cannot be empty.");
  } else if (qtype === "fill_blank") {
    const blanks = Array.isArray(a.blanks) ? (a.blanks as { accepted?: unknown }[]) : [];
    const inStem = (stem.match(BLANK_PATTERN) ?? []).length;
    if (blanks.length < 1 || blanks.length > 10) bad("Add 1 to 10 blanks.");
    else if (
      blanks.some(
        (b) =>
          !Array.isArray(b.accepted) ||
          b.accepted.length === 0 ||
          b.accepted.some((x) => typeof x !== "string" || !nonEmpty(x)),
      )
    )
      bad("Every blank needs at least one accepted answer.");
    else if (inStem !== blanks.length)
      bad(`The question has ${inStem} blank marker(s) like {{1}} but ${blanks.length} answer(s).`);
  }
  return issues;
}

export type ValidationResult = { ok: true; value: QuestionInput } | { ok: false; issues: Issue[] };

/** Validates and cleans a question. Used by the editor and by import. */
export function validateQuestion(raw: unknown): ValidationResult {
  const input = (raw ?? {}) as Record<string, unknown>;
  const parsed = shape.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? "question"),
        message: i.message,
      })),
    };
  }
  const v = parsed.data;
  const issues = answerIssues(v.qtype, v.stem, input.answer);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { ...v, answer: cleanAnswer(v.qtype, input.answer as AnswerSpec) } };
}

function cleanAnswer(qtype: QuestionType, a: AnswerSpec): AnswerSpec {
  if ("options" in a) {
    return {
      options: a.options.map((o) => ({ text: o.text.trim(), correct: o.correct === true })),
    };
  }
  if ("accepted" in a) return { accepted: a.accepted.map((x) => x.trim()) };
  if ("blanks" in a)
    return { blanks: a.blanks.map((b) => ({ accepted: b.accepted.map((x) => x.trim()) })) };
  void qtype;
  return { answer: a.answer };
}

/** An empty question for the editor of a given type. */
export function blankQuestion(qtype: QuestionType = "sba"): QuestionInput {
  const answer: AnswerSpec =
    qtype === "true_false"
      ? { answer: true }
      : qtype === "short_answer"
        ? { accepted: [""] }
        : qtype === "fill_blank"
          ? { blanks: [{ accepted: [""] }] }
          : {
              options: [
                { text: "", correct: true },
                { text: "", correct: false },
                { text: "", correct: false },
                { text: "", correct: false },
              ],
            };
  return {
    qtype,
    stem: "",
    explanation: "",
    answer,
    difficulty: null,
    source: "",
    institution: "",
    examName: "",
    examYear: null,
    path: [],
    tags: [],
  };
}
