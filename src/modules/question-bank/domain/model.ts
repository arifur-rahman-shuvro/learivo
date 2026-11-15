import { z } from "zod";

export const QUESTION_TYPES = [
  "sba",
  "single_choice",
  "multi_select",
  "true_false",
  "fill_blank",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const TYPE_LABELS: Record<QuestionType, string> = {
  sba: "Single best answer",
  single_choice: "Single choice",
  multi_select: "Multiple select",
  true_false: "True or false",
  fill_blank: "Fill in the blank",
};

export const TAXONOMY_KINDS = ["subject", "chapter", "topic", "subtopic"] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

export interface Option {
  text: string;
  correct: boolean;
}

/**
 * The stored shape of an answer. Which fields exist depends on the question type.
 * For true_false, each option is a statement and `correct` means "this statement is true".
 */
export type AnswerSpec =
  | { options: Option[] } // sba, single_choice, multi_select, true_false
  | { blanks: { accepted: string[] }[] }; // fill_blank

/** Every choice-based question has exactly this many options (or statements). */
export const OPTION_COUNT = 5;
/** Types whose answer is a list of OPTION_COUNT options. */
export const OPTION_TYPES = ["sba", "single_choice", "multi_select", "true_false"] as const;
export const isOptionType = (t: QuestionType) => (OPTION_TYPES as readonly string[]).includes(t);

export const MAX_OPTIONS = OPTION_COUNT;
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

  if (isOptionType(qtype)) {
    const options = Array.isArray(a.options) ? (a.options as Partial<Option>[]) : [];
    const noun = qtype === "true_false" ? "statements" : "options";
    if (options.length !== OPTION_COUNT) bad(`Use exactly ${OPTION_COUNT} ${noun}.`);
    else if (options.some((o) => typeof o.text !== "string" || !nonEmpty(o.text)))
      bad(qtype === "true_false" ? "Every statement needs text." : "Every option needs text.");
    else if (qtype === "multi_select") {
      if (!options.some((o) => o.correct === true)) bad("Mark at least one correct option.");
    } else if (qtype !== "true_false" && options.filter((o) => o.correct === true).length !== 1) {
      bad("Mark exactly one correct option.");
    }
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
  void qtype;
  if ("options" in a) {
    return {
      options: a.options.map((o) => ({ text: o.text.trim(), correct: o.correct === true })),
    };
  }
  return { blanks: a.blanks.map((b) => ({ accepted: b.accepted.map((x) => x.trim()) })) };
}

/** An empty question for the editor of a given type. */
export function blankQuestion(qtype: QuestionType = "sba"): QuestionInput {
  const answer: AnswerSpec =
    qtype === "fill_blank"
      ? { blanks: [{ accepted: [""] }] }
      : {
          // One correct option to start with, except true or false where each statement is its own.
          options: Array.from({ length: OPTION_COUNT }, (_, i) => ({
            text: "",
            correct: qtype === "true_false" ? false : i === 0,
          })),
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
