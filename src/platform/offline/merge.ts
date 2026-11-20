import type { QuestionRecord } from "../../modules/question-bank/data/repo.ts";
import type { QuestionInput } from "../../modules/question-bank/domain/model.ts";

/** The parts of a question that can be edited, with the names shown to the student. */
export const FIELDS: { key: keyof QuestionInput; label: string }[] = [
  { key: "stem", label: "Question" },
  { key: "answer", label: "Answer and options" },
  { key: "explanation", label: "Explanation" },
  { key: "qtype", label: "Type" },
  { key: "difficulty", label: "Difficulty" },
  { key: "path", label: "Subject" },
  { key: "tags", label: "Tags" },
  { key: "source", label: "Source" },
  { key: "institution", label: "Institution" },
  { key: "examName", label: "Exam name" },
  { key: "examYear", label: "Exam year" },
];

export type Side = "mine" | "theirs";

/** An offline edit that could not be applied by itself and needs the student to decide. */
export interface Conflict {
  /** The question's id. */
  id: string;
  kind: "edited" | "deleted";
  /** The question as it was when the offline edit started. Null for edits saved by an older version. */
  base: QuestionInput | null;
  mine: QuestionInput;
  /** The question as it is in the account now. Null when it was deleted there. */
  theirs: QuestionInput | null;
  /** Fields changed on both sides in different ways. Empty for a deletion. */
  clashes: (keyof QuestionInput)[];
  at: string;
}

export interface ResolvedConflict {
  conflict: Conflict;
  outcome: "mine" | "theirs" | "merged" | "re-added" | "discarded";
  at: string;
}

/** The editable part of a saved question. */
export function inputOf(r: QuestionRecord): QuestionInput {
  return {
    qtype: r.qtype,
    stem: r.stem,
    explanation: r.explanation,
    answer: structuredClone(r.answer),
    difficulty: r.difficulty,
    source: r.source,
    institution: r.institution,
    examName: r.examName,
    examYear: r.examYear,
    path: [...r.path],
    tags: [...r.tags],
  };
}

const norm = (k: keyof QuestionInput, v: unknown) =>
  JSON.stringify(k === "tags" ? [...(v as string[])].map((t) => t.toLowerCase()).sort() : v);

export const same = (k: keyof QuestionInput, a: QuestionInput, b: QuestionInput) =>
  norm(k, a[k]) === norm(k, b[k]);

/**
 * Compares the student's edit with what is in the account now, field by field, against the
 * version the edit started from. A field changed on one side only is taken from that side.
 * A field changed on both sides, differently, is a clash. Without a starting version, every
 * field that differs is a clash.
 */
export function threeWay(
  base: QuestionInput | null,
  mine: QuestionInput,
  theirs: QuestionInput,
): { merged: QuestionInput; clashes: (keyof QuestionInput)[] } {
  const merged = structuredClone(theirs);
  const clashes: (keyof QuestionInput)[] = [];
  for (const { key } of FIELDS) {
    if (same(key, mine, theirs)) continue;
    if (base && same(key, mine, base)) continue; // only the account changed it
    if (base && same(key, theirs, base)) {
      (merged as unknown as Record<string, unknown>)[key] = structuredClone(mine[key]); // only I changed it
      continue;
    }
    clashes.push(key);
  }
  return { merged, clashes };
}

/** Builds the question from the student's choices on the clashing fields. */
export function applyChoices(
  c: Conflict,
  choice: Side | Partial<Record<keyof QuestionInput, Side>>,
): QuestionInput {
  if (!c.theirs) return structuredClone(c.mine);
  if (choice === "mine") return structuredClone(c.mine);
  if (choice === "theirs") return structuredClone(c.theirs);
  const { merged } = threeWay(c.base, c.mine, c.theirs);
  for (const k of c.clashes) {
    (merged as unknown as Record<string, unknown>)[k] = structuredClone(
      (choice[k] === "mine" ? c.mine : c.theirs)[k],
    );
  }
  return merged;
}

/** A short readable form of one field, for the comparison screen. */
export function describe(key: keyof QuestionInput, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (key === "answer") {
    const a = v as {
      options?: { text: string; correct: boolean }[];
      blanks?: { accepted: string[] }[];
    };
    if (a.options)
      return a.options.map((o) => `${o.correct ? "[correct] " : ""}${o.text}`).join("\n");
    if (a.blanks)
      return a.blanks.map((b, i) => `Blank ${i + 1}: ${b.accepted.join(" / ")}`).join("\n");
  }
  if (key === "path") return (v as string[]).join(" › ") || "(none)";
  if (key === "tags") return (v as string[]).join(", ") || "(none)";
  return String(v);
}
