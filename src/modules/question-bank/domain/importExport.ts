import Papa from "papaparse";
import { contentHash } from "./hash.ts";
import {
  MAX_OPTIONS,
  QUESTION_TYPES,
  TAXONOMY_KINDS,
  validateQuestion,
  type AnswerSpec,
  type Issue,
  type QuestionInput,
  type QuestionType,
} from "./model.ts";

export const MAX_IMPORT_ROWS = 5000;

export type ImportFormat = "json" | "csv";

export interface ImportIssue extends Issue {
  /** JSON: position in the list (1 is the first question). CSV: spreadsheet row (the header is row 1). */
  row: number;
}

export type Duplicate = "bank" | "file" | null;

export interface ImportRow {
  row: number;
  input: QuestionInput;
  duplicate: Duplicate;
}

export type ImportReport =
  | { ok: false; message: string }
  | {
      ok: true;
      total: number;
      rows: ImportRow[];
      errors: ImportIssue[];
      /** Something the importer tidied up, for example a code fence from ChatGPT. */
      notice?: string;
    };

// ---------------------------------------------------------------------------
// Reading values leniently
// ---------------------------------------------------------------------------

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

const TYPE_ALIASES: Record<string, QuestionType> = {
  single_best_answer: "sba",
  true_or_false: "true_false",
  truefalse: "true_false",
  multiple_select: "multi_select",
  multiple_choice: "multi_select",
  fill_in_the_blank: "fill_blank",
  fill_in_blank: "fill_blank",
};

function readType(raw: Record<string, unknown>): QuestionType | null {
  const key = str(raw.type ?? raw.qtype ?? raw.question_type)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if ((QUESTION_TYPES as readonly string[]).includes(key)) return key as QuestionType;
  return TYPE_ALIASES[key] ?? null;
}

function readInt(v: unknown): number | null {
  const s = str(v);
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : Number.NaN;
}

function readBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  const s = str(v).toLowerCase();
  if (["true", "t", "yes", "y", "1"].includes(s)) return true;
  if (["false", "f", "no", "n", "0"].includes(s)) return false;
  return null;
}

function splitList(v: unknown, sep: RegExp): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  return str(v)
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 1-based positions of the correct options: 2, "2", "1;3", "1,3" or [1, 3]. */
function readCorrectPositions(v: unknown): number[] {
  if (Array.isArray(v)) return v.map(Number);
  if (typeof v === "number") return [v];
  return splitList(v, /[;,]/).map(Number);
}

function readOptions(raw: Record<string, unknown>): { text: string; correct: boolean }[] | null {
  let items: unknown[] | null = null;
  if (Array.isArray(raw.options)) items = raw.options;
  else {
    const cols: string[] = [];
    for (let i = 1; i <= MAX_OPTIONS; i++) cols.push(str(raw[`option${i}`] ?? raw[`option_${i}`]));
    // Keep positions: a blank option in the middle is a problem the validator should report.
    let last = cols.length;
    while (last > 0 && cols[last - 1] === "") last--;
    if (last > 0) items = cols.slice(0, last);
  }
  if (!items) return null;

  const positions = raw.correct === undefined ? [] : readCorrectPositions(raw.correct);
  return items.map((item, i) => {
    if (item !== null && typeof item === "object") {
      const o = item as Record<string, unknown>;
      return { text: str(o.text), correct: o.correct === true || positions.includes(i + 1) };
    }
    return { text: str(item), correct: positions.includes(i + 1) };
  });
}

function readAnswer(qtype: QuestionType, raw: Record<string, unknown>): AnswerSpec {
  if (qtype === "true_false") {
    const b = readBool(raw.answer);
    return { answer: b as boolean };
  }
  if (qtype === "short_answer") {
    const accepted = Array.isArray(raw.accepted)
      ? raw.accepted.map(str)
      : splitList(raw.answer, /\|/);
    return { accepted };
  }
  if (qtype === "fill_blank") {
    if (Array.isArray(raw.blanks)) {
      return {
        blanks: raw.blanks.map((b) => {
          if (Array.isArray(b)) return { accepted: b.map(str) };
          if (b !== null && typeof b === "object") {
            return { accepted: splitList((b as Record<string, unknown>).accepted, /\|/) };
          }
          return { accepted: splitList(b, /\|/) };
        }),
      };
    }
    return { blanks: splitList(raw.answer, /;/).map((b) => ({ accepted: splitList(b, /\|/) })) };
  }
  return { options: readOptions(raw) ?? [] };
}

/** Subject, chapter, topic, subtopic from fields or a `path` list. Gaps are reported. */
function readPath(raw: Record<string, unknown>, issues: Issue[]): string[] {
  if (Array.isArray(raw.path)) return raw.path.map(str).filter(Boolean).slice(0, 4);
  const levels = TAXONOMY_KINDS.map((k) => str(raw[k]));
  const path: string[] = [];
  levels.forEach((name, i) => {
    if (name === "") return;
    if (i > 0 && levels[i - 1] === "") {
      issues.push({
        field: TAXONOMY_KINDS[i]!,
        message: `${TAXONOMY_KINDS[i - 1]} is empty but ${TAXONOMY_KINDS[i]} is given.`,
      });
      return;
    }
    path.push(name);
  });
  return path;
}

/** Turn one imported record into a validated question, or a list of problems. */
export function rawToQuestion(
  raw: Record<string, unknown>,
  row: number,
): { ok: true; input: QuestionInput } | { ok: false; errors: ImportIssue[] } {
  const issues: Issue[] = [];
  const qtype = readType(raw);
  if (!qtype) {
    return {
      ok: false,
      errors: [
        { row, field: "type", message: `Type must be one of: ${QUESTION_TYPES.join(", ")}.` },
      ],
    };
  }

  const year = readInt(raw.examYear ?? raw.exam_year);
  const difficulty = readInt(raw.difficulty);
  if (Number.isNaN(year))
    issues.push({ field: "examYear", message: "Exam year must be a whole number." });
  if (Number.isNaN(difficulty))
    issues.push({ field: "difficulty", message: "Difficulty must be 1 to 5." });

  const candidate = {
    qtype,
    stem: str(raw.stem ?? raw.question),
    explanation: str(raw.explanation),
    answer: readAnswer(qtype, raw),
    difficulty: Number.isNaN(difficulty) ? null : difficulty,
    source: str(raw.source),
    institution: str(raw.institution),
    examName: str(raw.examName ?? raw.exam_name),
    examYear: Number.isNaN(year) ? null : year,
    path: readPath(raw, issues),
    tags: splitList(raw.tags, /;/),
  };

  const result = validateQuestion(candidate);
  if (!result.ok) issues.push(...result.issues);
  if (issues.length > 0 || !result.ok) {
    return { ok: false, errors: issues.map((i) => ({ row, ...i })) };
  }
  return { ok: true, input: result.value };
}

// ---------------------------------------------------------------------------
// Parsing a file
// ---------------------------------------------------------------------------

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/** Undo the apostrophe that spreadsheet-safe export puts in front of =, +, -, @. */
const unescapeFormula = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

/** "line 3, column 5" for a JSON syntax error, when the browser says where it is. */
function errorPlace(text: string, error: unknown): string {
  const msg = error instanceof Error ? error.message : "";
  const lc = /line (\d+) column (\d+)/i.exec(msg);
  if (lc) return ` (line ${lc[1]}, column ${lc[2]})`;
  const pos = /position (\d+)/i.exec(msg);
  if (pos) {
    const before = text.slice(0, Number(pos[1]));
    const line = before.split("\n").length;
    const column = before.length - before.lastIndexOf("\n");
    return ` (line ${line}, column ${column})`;
  }
  return "";
}

/**
 * Parses JSON that was copied from a chat: tries the text as it is first, then without a
 * ```json code fence, then without sentences before or after the list.
 */
export function parseLooseJson(
  text: string,
): { ok: true; data: unknown; notice?: string } | { ok: false; message: string } {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (first) {
    const fenced = /```[a-zA-Z]*[ \t]*\r?\n?([\s\S]*?)```/.exec(text);
    const inner = (fenced ? fenced[1]! : text).trim();
    const start = inner.search(/[[{]/);
    const end = Math.max(inner.lastIndexOf("]"), inner.lastIndexOf("}"));
    if (start !== -1 && end > start) {
      try {
        const data = JSON.parse(inner.slice(start, end + 1));
        return {
          ok: true,
          data,
          notice: fenced
            ? "Removed the code block markers around the JSON."
            : "Ignored the text before or after the JSON.",
        };
      } catch {
        // fall through to the original error
      }
    }
    return {
      ok: false,
      message: `This is not valid JSON${errorPlace(text, first)}. Check for a missing comma, quote or bracket.`,
    };
  }
}

export function parseImportFile(
  content: string,
  format: ImportFormat,
):
  | { ok: true; records: { row: number; raw: Record<string, unknown> }[]; notice?: string }
  | { ok: false; message: string } {
  const text = stripBom(content);
  if (text.trim() === "") return { ok: false, message: "The file is empty." };

  if (format === "json") {
    const parsed = parseLooseJson(text);
    if (!parsed.ok) return parsed;
    const data = parsed.data;
    const obj =
      data !== null && typeof data === "object" ? (data as Record<string, unknown>) : null;
    // One question on its own is accepted as a list of one.
    const single = obj && !Array.isArray(data) && ("stem" in obj || "question" in obj);
    const list = Array.isArray(data) ? data : single ? [data] : obj?.questions;
    if (!Array.isArray(list)) {
      return {
        ok: false,
        message: 'Expected a list of questions, or an object with a "questions" list.',
      };
    }
    if (list.length === 0) return { ok: false, message: "The list has no questions in it." };
    if (list.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        message: `This file has ${list.length} questions. Import up to ${MAX_IMPORT_ROWS} at a time.`,
      };
    }
    return {
      ok: true,
      notice: parsed.notice,
      records: list.map((raw, i) => ({
        row: i + 1,
        raw:
          raw !== null && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : {},
      })),
    };
  }

  // Blank rows are skipped after parsing, not by the parser, so row numbers stay the same
  // as the row numbers a spreadsheet shows (the header is row 1).
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: false,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const numbered = parsed.data.map((r, i) => ({ row: i + 2, r }));
  const rows = numbered.filter(({ r }) =>
    Object.values(r).some((v) => String(v ?? "").trim() !== ""),
  );
  if (rows.length === 0)
    return { ok: false, message: "No rows were found. The first line must be the column names." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      message: `This file has ${rows.length} rows. Import up to ${MAX_IMPORT_ROWS} at a time.`,
    };
  }
  return {
    ok: true,
    records: rows.map(({ row, r }) => ({
      row,
      raw: Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, typeof v === "string" ? unescapeFormula(v) : v]),
      ),
    })),
  };
}

/**
 * Read, validate and compare a file with the existing bank.
 * @param existingHashes content hashes already in the student's bank
 */
export function analyzeImport(
  content: string,
  format: ImportFormat,
  existingHashes: ReadonlySet<string>,
): ImportReport {
  const file = parseImportFile(content, format);
  if (!file.ok) return file;

  const rows: ImportRow[] = [];
  const errors: ImportIssue[] = [];
  const seen = new Set<string>();
  for (const { row, raw } of file.records) {
    const r = rawToQuestion(raw, row);
    if (!r.ok) {
      errors.push(...r.errors);
      continue;
    }
    const hash = contentHash(r.input.stem, r.input.qtype);
    const duplicate: Duplicate = existingHashes.has(hash) ? "bank" : seen.has(hash) ? "file" : null;
    seen.add(hash);
    rows.push({ row, input: r.input, duplicate });
  }
  return { ok: true, total: file.records.length, rows, errors, notice: file.notice };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** The importable shape of a question: the same fields the import reads. */
export function questionToRecord(q: QuestionInput): Record<string, unknown> {
  const rec: Record<string, unknown> = { type: q.qtype, stem: q.stem, explanation: q.explanation };
  if ("options" in q.answer) rec.options = q.answer.options;
  if ("answer" in q.answer) rec.answer = q.answer.answer;
  if ("accepted" in q.answer) rec.accepted = q.answer.accepted;
  if ("blanks" in q.answer) rec.blanks = q.answer.blanks.map((b) => b.accepted);
  TAXONOMY_KINDS.forEach((k, i) => {
    if (q.path[i]) rec[k] = q.path[i];
  });
  rec.difficulty = q.difficulty;
  rec.tags = q.tags;
  rec.source = q.source;
  rec.institution = q.institution;
  rec.examName = q.examName;
  rec.examYear = q.examYear;
  return rec;
}

export function exportJson(questions: readonly QuestionInput[]): string {
  return JSON.stringify(
    { format: "learivo-questions", version: 1, questions: questions.map(questionToRecord) },
    null,
    2,
  );
}

export const CSV_COLUMNS = [
  "type",
  "stem",
  "explanation",
  ...Array.from({ length: MAX_OPTIONS }, (_, i) => `option${i + 1}`),
  "correct",
  "answer",
  "difficulty",
  ...TAXONOMY_KINDS,
  "tags",
  "source",
  "institution",
  "exam_name",
  "exam_year",
] as const;

function csvRow(q: QuestionInput): Record<string, string | number> {
  const row: Record<string, string | number> = Object.fromEntries(CSV_COLUMNS.map((c) => [c, ""]));
  row.type = q.qtype;
  row.stem = q.stem;
  row.explanation = q.explanation;
  const a = q.answer;
  if ("options" in a) {
    a.options.forEach((o, i) => (row[`option${i + 1}`] = o.text));
    row.correct = a.options.flatMap((o, i) => (o.correct ? [i + 1] : [])).join(";");
  } else if ("answer" in a) row.answer = String(a.answer);
  else if ("accepted" in a) row.answer = a.accepted.join("|");
  else row.answer = a.blanks.map((b) => b.accepted.join("|")).join(";");
  row.difficulty = q.difficulty ?? "";
  TAXONOMY_KINDS.forEach((k, i) => (row[k] = q.path[i] ?? ""));
  row.tags = q.tags.join(";");
  row.source = q.source;
  row.institution = q.institution;
  row.exam_name = q.examName;
  row.exam_year = q.examYear ?? "";
  return row;
}

/**
 * CSV for spreadsheets. Cells starting with = + - @ are prefixed with an apostrophe so a
 * spreadsheet never runs them as a formula; the importer removes that apostrophe again.
 */
export function exportCsv(questions: readonly QuestionInput[]): string {
  return Papa.unparse(
    { fields: [...CSV_COLUMNS], data: questions.map(csvRow) },
    { escapeFormulae: true, newline: "\r\n" },
  );
}
