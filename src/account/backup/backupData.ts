import type { QuestionRepo } from "../../modules/question-bank/data/repo.ts";
import { DEFAULT_QUERY } from "../../modules/question-bank/data/repo.ts";
import { contentHash } from "../../modules/question-bank/domain/hash.ts";
import {
  analyzeImport,
  questionToRecord,
} from "../../modules/question-bank/domain/importExport.ts";
import type { WorkspaceRepo } from "../../modules/workspace/data/repo.ts";
import { cleanExamTarget, type ExamTarget } from "../../modules/workspace/domain/examTarget.ts";
import { LIMITS } from "../../modules/workspace/domain/cards.ts";
import type { Attempt, AttemptRepo } from "../../modules/practice/data/repo.ts";
import type { ExamRule } from "../../modules/practice/domain/session.ts";
import { validateQuestion } from "../../modules/question-bank/domain/model.ts";
import type { Response, Snapshot, Verdict } from "../../modules/practice/domain/grading.ts";
import { nodeIdForName } from "../../modules/practice/ui/start.ts";
import { REASONS, type Reason } from "../../modules/practice/domain/reasons.ts";
import type { Card } from "../../modules/workspace/domain/scheduler.ts";
import { CONFIDENCE, type Confidence } from "../../modules/practice/domain/confidence.ts";
import {
  cleanLayout,
  DEFAULT_HOME_LAYOUT,
  type HomeLayout,
} from "../../modules/workspace/domain/homeLayout.ts";

const BACKUP_FORMAT = "learivo-backup";
const DEFAULT_GOAL = 20;

interface BackupAttemptItem {
  /** Content hash of the bank question this came from; null when it is gone. */
  questionHash: string | null;
  snapshot: Snapshot;
  response: Response | null;
  flagged: boolean;
  seconds: number;
  mistakeReason: Reason | null;
  /** Version 3 and later. */
  confidence: Confidence | null;
  verdict: Verdict | null;
  credit: number;
  marks: number;
}

interface BackupAttempt {
  kind: "practice" | "exam";
  title: string;
  /** Title of the saved exam it was taken from, when that exam still exists. */
  examTitle: string | null;
  instantFeedback: boolean;
  timeLimitSec: number | null;
  marksCorrect: number;
  marksWrong: number;
  startedAt: string;
  submittedAt: string;
  secondsSpent: number;
  items: BackupAttemptItem[];
}

interface BackupExam {
  title: string;
  instructions: string;
  timeLimitSec: number | null;
  marksCorrect: number;
  marksWrong: number;
  randomize: boolean;
  /** Each rule names its subject by path ("Anatomy › Heart"), not by id, so it survives a restore. */
  rules: { path: string[]; count: number }[];
}

interface BackupCard {
  questionHash: string;
  card: Card;
}

/** Sessions are read in pages this size, so a long history never needs one huge request. */
const PAGE = 500;

/** What a version 3 file says about itself, so damage and truncation can be noticed. */
export interface Manifest {
  schema: 3;
  counts: Record<string, number>;
  /** SHA-256 (hex) of the file's data, written without this manifest. */
  sha256: string;
}

const COUNTED = [
  "questions",
  "notes",
  "bookmarks",
  "flashcards",
  "glossary",
  "cards",
  "exams",
  "attempts",
  "collections",
] as const;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  /** 2 adds practice history, exams and revision state; 3 adds collections, confidence, the Home layout and a manifest. Older files are still read. */
  version: 1 | 2 | 3;
  createdAt: string;
  questions: Record<string, unknown>[];
  /** Notes point at a question by its content hash, so they survive a restore into another account. */
  notes: { questionHash: string | null; title: string; body: string }[];
  bookmarks: string[];
  flashcards: { front: string; back: string }[];
  glossary: { term: string; definition: string }[];
  examTarget: ExamTarget;
  dailyGoal: number;
  /** Version 2 and later; empty in older files. */
  cards: BackupCard[];
  exams: BackupExam[];
  attempts: BackupAttempt[];
  /** Version 3. Members are named by content hash. */
  collections: { name: string; hashes: string[] }[];
  /** Version 3. Null when the Home layout was never changed. */
  homeLayout: HomeLayout | null;
  /** Version 3. */
  manifest?: Manifest;
}

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The file's data without its manifest, in the order it was written. */
const dataOf = (b: object) =>
  JSON.stringify(Object.fromEntries(Object.entries(b).filter(([k]) => k !== "manifest")));

export type Integrity =
  | { kind: "none" } // an older file: nothing to check against
  | { kind: "ok"; counts: Record<string, number> }
  | { kind: "damaged"; reason: string };

/** Checks a version 3 file against its own manifest: record counts first, then SHA-256. */
export async function checkIntegrity(text: string): Promise<Integrity> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: "none" }; // parseBackup explains this one
  }
  const o = obj(raw);
  if (o.version !== 3) return { kind: "none" };
  const m = obj(o.manifest);
  const counts = obj(m.counts);
  if (m.schema !== 3 || typeof m.sha256 !== "string") {
    return { kind: "damaged", reason: "The file has no valid manifest." };
  }
  for (const k of COUNTED) {
    const declared = counts[k];
    if (typeof declared !== "number" || declared !== list(o[k]).length) {
      return {
        kind: "damaged",
        reason: `The file says it holds ${String(declared)} ${k}, but ${list(o[k]).length} are in it. It may be cut short.`,
      };
    }
  }
  if ((await sha256Hex(dataOf(o))) !== m.sha256) {
    return { kind: "damaged", reason: "The file was changed or damaged after it was saved." };
  }
  return { kind: "ok", counts: Object.fromEntries(COUNTED.map((k) => [k, counts[k] as number])) };
}

async function idsAndHashes(repo: QuestionRepo): Promise<Map<string, string>> {
  const out = new Map<string, string>(); // id -> hash
  for (const status of ["active", "archived"] as const) {
    for (let offset = 0; ; offset += 200) {
      const page = await repo.list({ ...DEFAULT_QUERY, status, offset, limit: 200 });
      for (const q of page.items) out.set(q.id, contentHash(q.stem, q.qtype));
      if (page.items.length < 200) break;
    }
  }
  return out;
}

export async function buildBackup(
  bank: QuestionRepo,
  ws: WorkspaceRepo,
  attempts?: AttemptRepo,
): Promise<Backup> {
  const [hashes, questions, notes, bookmarks, flashcards, glossary, examTarget, dailyGoal, cards] =
    await Promise.all([
      idsAndHashes(bank),
      bank.exportAll(),
      ws.notes(),
      ws.bookmarks(),
      ws.flashcards(),
      ws.glossary(),
      ws.examTarget(),
      ws.dailyGoal(),
      ws.cards(),
    ]);
  const hashOf = (id: string | null) => (id ? (hashes.get(id) ?? null) : null);

  let exams: BackupExam[] = [];
  let history: BackupAttempt[] = [];
  if (attempts) {
    const nodes = await bank.taxonomy();
    const pathOf = (nodeId: string | null): string[] => {
      const out: string[] = [];
      let cur = nodes.find((n) => n.id === nodeId);
      while (cur) {
        out.unshift(cur.name);
        cur = nodes.find((n) => n.id === cur!.parentId);
      }
      return out;
    };
    const saved = await attempts.exams();
    exams = saved.map((e) => ({
      title: e.title,
      instructions: e.instructions,
      timeLimitSec: e.timeLimitSec,
      marksCorrect: e.marksCorrect,
      marksWrong: e.marksWrong,
      randomize: e.randomize,
      rules: e.rules.map((r) => ({ path: pathOf(r.nodeId), count: r.count })),
    }));
    const examTitle = new Map(saved.map((e) => [e.id, e.title]));
    const heads: Attempt[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await attempts.list(PAGE, offset);
      heads.push(...page.filter((a) => a.status === "submitted" && a.submittedAt));
      if (page.length < PAGE) break;
    }
    for (let i = 0; i < heads.length; i += 10) {
      const full = await Promise.all(heads.slice(i, i + 10).map((h) => attempts.get(h.id)));
      for (const a of full) {
        if (!a || !a.submittedAt) continue;
        history.push({
          kind: a.kind,
          title: a.title,
          examTitle: a.examId ? (examTitle.get(a.examId) ?? null) : null,
          instantFeedback: a.instantFeedback,
          timeLimitSec: a.timeLimitSec,
          marksCorrect: a.marksCorrect,
          marksWrong: a.marksWrong,
          startedAt: a.startedAt,
          submittedAt: a.submittedAt,
          secondsSpent: a.secondsSpent,
          items: a.items.map((x) => ({
            questionHash: hashOf(x.questionId),
            snapshot: x.snapshot,
            response: x.response,
            flagged: x.flagged,
            seconds: x.seconds,
            mistakeReason: x.mistakeReason,
            confidence: x.confidence ?? null,
            verdict: x.verdict,
            credit: x.credit ?? 0,
            marks: x.marks ?? 0,
          })),
        });
      }
    }
    history = history.sort((x, y) => x.startedAt.localeCompare(y.startedAt));
  }

  const collections: Backup["collections"] = [];
  for (const c of await bank.collections()) {
    const hs: string[] = [];
    for (let offset = 0; ; offset += 200) {
      const page = await bank.list({
        ...DEFAULT_QUERY,
        collectionId: c.id,
        offset,
        limit: 200,
      });
      for (const q of page.items) hs.push(contentHash(q.stem, q.qtype));
      if (page.items.length < 200) break;
    }
    collections.push({ name: c.name, hashes: hs });
  }
  const layout = await ws.homeLayout().catch(() => DEFAULT_HOME_LAYOUT);
  const body: Omit<Backup, "manifest"> = {
    format: BACKUP_FORMAT,
    version: 3,
    createdAt: new Date().toISOString(),
    questions: questions.map(questionToRecord),
    notes: notes.map((n) => ({
      questionHash: n.questionId ? (hashes.get(n.questionId) ?? null) : null,
      title: n.title,
      body: n.body,
    })),
    bookmarks: [...bookmarks].flatMap((id) => (hashes.has(id) ? [hashes.get(id) as string] : [])),
    flashcards: flashcards.map((c) => ({ front: c.front, back: c.back })),
    glossary: glossary.map((t) => ({ term: t.term, definition: t.definition })),
    examTarget,
    dailyGoal,
    cards: cards.flatMap((c) => {
      const h = hashOf(c.questionId);
      if (!h) return [];
      const { questionId: _q, ...card } = c;
      void _q;
      return [{ questionHash: h, card }];
    }),
    exams,
    attempts: history,
    collections,
    homeLayout: JSON.stringify(layout) === JSON.stringify(DEFAULT_HOME_LAYOUT) ? null : layout,
  };
  const counts = Object.fromEntries(COUNTED.map((k) => [k, body[k].length]));
  return { ...body, manifest: { schema: 3, counts, sha256: await sha256Hex(dataOf(body)) } };
}

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: string };

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() !== "" && v.length <= max ? v : null;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

const num = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};
const when = (v: unknown): string | null =>
  typeof v === "string" && !Number.isNaN(new Date(v).getTime()) ? v : null;

function cleanExam(raw: unknown): BackupExam | null {
  const x = obj(raw);
  const title = str(x.title, 120);
  if (!title) return null;
  const rules = list(x.rules).flatMap((r) => {
    const y = obj(r);
    const path = list(y.path).filter((p): p is string => typeof p === "string");
    const count = num(y.count, 1, 500, 0);
    return count > 0 ? [{ path, count: Math.round(count) }] : [];
  });
  const limit = x.timeLimitSec === null ? null : num(x.timeLimitSec, 60, 86400, 0) || null;
  return {
    title,
    instructions: typeof x.instructions === "string" ? x.instructions.slice(0, 2000) : "",
    timeLimitSec: limit,
    marksCorrect: num(x.marksCorrect, 0, 100, 1),
    marksWrong: num(x.marksWrong, 0, 100, 0),
    randomize: x.randomize === true,
    rules,
  };
}

function cleanCard(raw: unknown): BackupCard | null {
  const x = obj(raw);
  const c = obj(x.card);
  const due = when(c.due);
  if (typeof x.questionHash !== "string" || !due) return null;
  if (c.state !== "new" && c.state !== "review") return null;
  return {
    questionHash: x.questionHash,
    card: {
      state: c.state,
      due,
      stability: num(c.stability, 0, 100000, 0),
      difficulty: num(c.difficulty, 0, 100, 5),
      reps: Math.round(num(c.reps, 0, 100000, 0)),
      lapses: Math.round(num(c.lapses, 0, 100000, 0)),
      lastReview: when(c.lastReview),
    },
  };
}

function cleanResponse(v: unknown): Response | null {
  const r = obj(v);
  if (Array.isArray(r.choices) && r.choices.every((n) => Number.isInteger(n) && n >= 0 && n < 20))
    return { choices: r.choices as number[] };
  if (
    Array.isArray(r.marks) &&
    r.marks.length <= 20 &&
    r.marks.every((m) => m === null || typeof m === "boolean")
  )
    return { marks: r.marks as (boolean | null)[] };
  if (
    Array.isArray(r.blanks) &&
    r.blanks.length <= 10 &&
    r.blanks.every((b) => typeof b === "string" && b.length <= 500)
  )
    return { blanks: r.blanks as string[] };
  return null;
}

const VERDICTS = ["correct", "partial", "wrong", "unanswered"] as const;

function cleanItem(raw: unknown): BackupAttemptItem | null {
  const x = obj(raw);
  const s = obj(x.snapshot);
  // The frozen question goes through the same checks as an imported one, so grading never meets a broken answer.
  const v = validateQuestion({
    qtype: s.qtype,
    stem: s.stem,
    explanation: s.explanation,
    answer: s.answer,
    difficulty: s.difficulty ?? null,
    path: s.path,
    tags: [],
  });
  if (!v.ok) return null;
  const verdict = VERDICTS.find((k) => k === x.verdict) ?? null;
  const reason = REASONS.find((r) => r.id === x.mistakeReason)?.id ?? null;
  return {
    questionHash: typeof x.questionHash === "string" ? x.questionHash : null,
    snapshot: {
      qtype: v.value.qtype,
      stem: v.value.stem,
      explanation: v.value.explanation ?? "",
      answer: v.value.answer,
      difficulty: v.value.difficulty ?? null,
      path: v.value.path ?? [],
    },
    response: cleanResponse(x.response),
    flagged: x.flagged === true,
    seconds: Math.round(num(x.seconds, 0, 86400, 0)),
    mistakeReason: reason,
    confidence: CONFIDENCE.find((c) => c.id === x.confidence)?.id ?? null,
    verdict,
    credit: num(x.credit, 0, 1, 0),
    marks: num(x.marks, -100, 100, 0),
  };
}

function cleanAttempt(raw: unknown): BackupAttempt | null {
  const x = obj(raw);
  const title = str(x.title, 120);
  const startedAt = when(x.startedAt);
  const submittedAt = when(x.submittedAt);
  if (!title || !startedAt || !submittedAt) return null;
  if (x.kind !== "practice" && x.kind !== "exam") return null;
  const items = list(x.items).slice(0, 500).map(cleanItem);
  if (items.length === 0 || items.some((i) => i === null)) return null;
  const limit = x.timeLimitSec === null ? null : num(x.timeLimitSec, 60, 86400, 0) || null;
  return {
    kind: x.kind,
    title,
    examTitle: typeof x.examTitle === "string" ? x.examTitle : null,
    instantFeedback: x.instantFeedback === true,
    timeLimitSec: limit,
    marksCorrect: num(x.marksCorrect, 0, 100, 1),
    marksWrong: num(x.marksWrong, 0, 100, 0),
    startedAt,
    submittedAt,
    secondsSpent: Math.round(num(x.secondsSpent, 0, 86400 * 7, 0)),
    items: items as BackupAttemptItem[],
  };
}

/** Reads a backup file. Anything unusable is dropped quietly; a file that is not a backup is refused. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not a Learivo backup." };
  }
  const o = obj(raw);
  if (o.format !== BACKUP_FORMAT) return { ok: false, error: "This file is not a Learivo backup." };
  if (o.version !== 1 && o.version !== 2 && o.version !== 3)
    return { ok: false, error: "This backup was made by a newer version." };
  const flashcards = list(o.flashcards).flatMap((c) => {
    const x = obj(c);
    const front = str(x.front, LIMITS.front);
    const back = str(x.back, LIMITS.back);
    return front && back ? [{ front, back }] : [];
  });
  const glossary = list(o.glossary).flatMap((t) => {
    const x = obj(t);
    const term = str(x.term, LIMITS.term);
    const definition = str(x.definition, LIMITS.definition);
    return term && definition ? [{ term, definition }] : [];
  });
  const notes = list(o.notes).flatMap((n) => {
    const x = obj(n);
    const body = typeof x.body === "string" ? x.body : "";
    const title = typeof x.title === "string" ? x.title : "";
    if (body.trim() === "" && title.trim() === "") return [];
    return [
      {
        questionHash: typeof x.questionHash === "string" ? x.questionHash : null,
        title,
        body,
      },
    ];
  });
  const goal = Number(o.dailyGoal);
  const exams = list(o.exams).flatMap((e) => {
    const x = cleanExam(e);
    return x ? [x] : [];
  });
  const cards = list(o.cards).flatMap((c) => {
    const x = cleanCard(c);
    return x ? [x] : [];
  });
  const attempts = list(o.attempts).flatMap((a) => {
    const x = cleanAttempt(a);
    return x ? [x] : [];
  });
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: 3,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
      questions: list(o.questions).map(obj),
      notes,
      bookmarks: list(o.bookmarks).filter((h): h is string => typeof h === "string"),
      flashcards,
      glossary,
      examTarget: cleanExamTarget(o.examTarget),
      dailyGoal: Number.isInteger(goal) && goal >= 1 && goal <= 500 ? goal : DEFAULT_GOAL,
      cards,
      exams,
      attempts,
      collections: list(o.collections).flatMap((c) => {
        const x = obj(c);
        const name = str(x.name, 80);
        const hashes = list(x.hashes).filter((h): h is string => typeof h === "string");
        return name ? [{ name, hashes }] : [];
      }),
      homeLayout: o.homeLayout ? cleanLayout(o.homeLayout) : null,
    },
  };
}

export interface RestoreResult {
  questions: number;
  questionsSkipped: number;
  questionsInvalid: number;
  notes: number;
  bookmarks: number;
  flashcards: number;
  glossary: number;
  settings: number;
  /** Revision cards restored. */
  cards: number;
  exams: number;
  /** Finished practice and exam sessions restored. */
  attempts: number;
  /** Collections created or filled. */
  collections: number;
  failure?: string;
}

/** What a restore would add, counted against what is already stored. Nothing is changed. */
export async function previewRestore(
  backup: Backup,
  bank: QuestionRepo,
): Promise<{ newQuestions: number; existing: number; invalid: number }> {
  const have = new Set((await idsAndHashes(bank)).values());
  const rep = analyzeImport(questionsFile(backup), "json", have);
  if (!rep.ok) return { newQuestions: 0, existing: 0, invalid: backup.questions.length };
  return {
    newQuestions: rep.rows.filter((r) => !r.duplicate).length,
    existing: rep.rows.filter((r) => r.duplicate).length,
    invalid: rep.errors.length,
  };
}

function questionsFile(b: Backup): string {
  return JSON.stringify({ format: "learivo-questions", version: 1, questions: b.questions });
}

/** Adds what is missing. Never changes or deletes anything that is already there. */
export async function restoreBackup(
  backup: Backup,
  bank: QuestionRepo,
  ws: WorkspaceRepo,
  attempts?: AttemptRepo,
): Promise<RestoreResult> {
  const r: RestoreResult = {
    questions: 0,
    questionsSkipped: 0,
    questionsInvalid: 0,
    notes: 0,
    bookmarks: 0,
    flashcards: 0,
    glossary: 0,
    settings: 0,
    cards: 0,
    exams: 0,
    attempts: 0,
    collections: 0,
  };
  try {
    const have = new Set((await idsAndHashes(bank)).values());
    const rep = analyzeImport(questionsFile(backup), "json", have);
    if (rep.ok) {
      const fresh = rep.rows.filter((x) => !x.duplicate).map((x) => x.input);
      for (let i = 0; i < fresh.length; i += 500) await bank.create(fresh.slice(i, i + 500));
      r.questions = fresh.length;
      r.questionsSkipped = rep.rows.length - fresh.length;
      r.questionsInvalid = rep.errors.length;
    }

    const idByHash = new Map<string, string>();
    for (const [id, h] of await idsAndHashes(bank)) idByHash.set(h, id);

    const marked = await ws.bookmarks();
    for (const h of backup.bookmarks) {
      const id = idByHash.get(h);
      if (id && !marked.has(id)) {
        await ws.setBookmark(id, true);
        marked.add(id);
        r.bookmarks += 1;
      }
    }

    const notes = await ws.notes();
    const noteKey = (q: string | null, t: string, b: string) => `${q ?? ""}\u0000${t}\u0000${b}`;
    const haveNotes = new Set(notes.map((n) => noteKey(n.questionId, n.title, n.body)));
    for (const n of backup.notes) {
      const qid = n.questionHash ? (idByHash.get(n.questionHash) ?? null) : null;
      if (n.questionHash && !qid) continue; // its question is not in this bank
      const key = noteKey(qid, n.title, n.body);
      if (haveNotes.has(key)) continue;
      await ws.saveNote({ id: null, questionId: qid, title: n.title, body: n.body });
      haveNotes.add(key);
      r.notes += 1;
    }

    const cards = new Set((await ws.flashcards()).map((c) => `${c.front}\u0000${c.back}`));
    for (const c of backup.flashcards) {
      const key = `${c.front}\u0000${c.back}`;
      if (cards.has(key)) continue;
      await ws.saveFlashcard({ id: null, front: c.front, back: c.back });
      cards.add(key);
      r.flashcards += 1;
    }

    const terms = new Set((await ws.glossary()).map((t) => t.term.trim().toLowerCase()));
    for (const t of backup.glossary) {
      const key = t.term.trim().toLowerCase();
      if (terms.has(key)) continue;
      await ws.saveTerm({ id: null, term: t.term, definition: t.definition });
      terms.add(key);
      r.glossary += 1;
    }

    if (backup.examTarget.date && (await ws.examTarget()).date === null) {
      await ws.setExamTarget(backup.examTarget);
      r.settings += 1;
    }
    if (backup.dailyGoal !== DEFAULT_GOAL && (await ws.dailyGoal()) === DEFAULT_GOAL) {
      await ws.setDailyGoal(backup.dailyGoal);
      r.settings += 1;
    }

    const haveCards = new Set((await ws.cards()).map((c) => c.questionId));
    for (const c of backup.cards) {
      const id = idByHash.get(c.questionHash);
      if (!id || haveCards.has(id)) continue;
      await ws.saveCard(id, c.card);
      haveCards.add(id);
      r.cards += 1;
    }

    await restoreCollections(backup, bank, idByHash, r);
    if (backup.homeLayout) {
      const cur = await ws.homeLayout().catch(() => DEFAULT_HOME_LAYOUT);
      if (JSON.stringify(cur) === JSON.stringify(DEFAULT_HOME_LAYOUT)) {
        await ws.setHomeLayout(backup.homeLayout);
        r.settings += 1;
      }
    }

    if (attempts) await restoreHistory(backup, bank, attempts, idByHash, r);
  } catch (e) {
    r.failure = e instanceof Error ? e.message : "Something went wrong.";
  }
  return r;
}

/** Collections by name; members are matched by content hash. Adding a member twice changes nothing. */
async function restoreCollections(
  backup: Backup,
  bank: QuestionRepo,
  idByHash: Map<string, string>,
  r: RestoreResult,
) {
  const existing = new Map((await bank.collections()).map((c) => [c.name.toLowerCase(), c.id]));
  for (const c of backup.collections) {
    let id = existing.get(c.name.toLowerCase());
    if (!id) {
      id = (await bank.addCollection(c.name)).id;
      existing.set(c.name.toLowerCase(), id);
      r.collections += 1;
    }
    const members = c.hashes.flatMap((h) => (idByHash.has(h) ? [idByHash.get(h)!] : []));
    for (let i = 0; i < members.length; i += 200) {
      await bank.bulk(members.slice(i, i + 200), {
        kind: "collection",
        collectionId: id,
        add: true,
      });
    }
  }
}

const attemptKey = (startedAt: string, title: string) =>
  `${new Date(startedAt).getTime()}\u0000${title}`;

/** Saved exams first, then finished sessions. Anything already present is left alone. */
async function restoreHistory(
  backup: Backup,
  bank: QuestionRepo,
  attempts: AttemptRepo,
  idByHash: Map<string, string>,
  r: RestoreResult,
) {
  const nodes = await bank.taxonomy();
  const examId = new Map<string, string>();
  for (const e of await attempts.exams()) examId.set(e.title, e.id);

  for (const e of backup.exams) {
    if (examId.has(e.title)) continue;
    const rules = e.rules.flatMap((x): ExamRule[] => {
      if (x.path.length === 0) return [{ nodeId: null, count: x.count }];
      const nodeId = nodeIdForName(nodes, x.path.join(" › "));
      return nodeId ? [{ nodeId, count: x.count }] : [];
    });
    if (rules.length === 0) continue; // none of its subjects exist here
    const id = await attempts.saveExam(null, {
      title: e.title,
      instructions: e.instructions,
      timeLimitSec: e.timeLimitSec,
      marksCorrect: e.marksCorrect,
      marksWrong: e.marksWrong,
      randomize: e.randomize,
      rules,
    });
    examId.set(e.title, id);
    r.exams += 1;
  }

  const have = new Set<string>();
  for (let offset = 0; ; offset += PAGE) {
    const page = await attempts.list(PAGE, offset);
    for (const a of page) have.add(attemptKey(a.startedAt, a.title));
    if (page.length < PAGE) break;
  }
  for (const a of backup.attempts) {
    const key = attemptKey(a.startedAt, a.title);
    if (have.has(key)) continue;
    const id = await attempts.create({
      kind: a.kind,
      examId: a.examTitle ? (examId.get(a.examTitle) ?? null) : null,
      title: a.title,
      instantFeedback: a.instantFeedback,
      timeLimitSec: a.timeLimitSec,
      marksCorrect: a.marksCorrect,
      marksWrong: a.marksWrong,
      startedAt: a.startedAt,
      items: a.items.map((x) => ({
        questionId: x.questionHash ? (idByHash.get(x.questionHash) ?? null) : null,
        snapshot: x.snapshot,
      })),
    });
    for (let i = 0; i < a.items.length; i += 10) {
      await Promise.all(
        a.items.slice(i, i + 10).flatMap((x, k) =>
          x.response || x.flagged || x.confidence
            ? [
                attempts.patchItem(id, i + k, {
                  response: x.response,
                  flagged: x.flagged,
                  ...(x.confidence ? { confidence: x.confidence } : {}),
                }),
              ]
            : [],
        ),
      );
    }
    const count = (v: Verdict) => a.items.filter((x) => x.verdict === v).length;
    await attempts.submit(
      id,
      a.items.map((x, position) => ({
        position,
        verdict: x.verdict ?? "unanswered",
        credit: x.credit,
        marks: x.marks,
        seconds: x.seconds,
      })),
      {
        score: Math.round(a.items.reduce((n, x) => n + x.marks, 0) * 100) / 100,
        correct: count("correct"),
        partial: count("partial"),
        wrong: count("wrong"),
        unanswered: a.items.filter((x) => !x.verdict || x.verdict === "unanswered").length,
        secondsSpent: a.secondsSpent,
        submittedAt: a.submittedAt,
      },
    );
    for (let i = 0; i < a.items.length; i++) {
      const reason = a.items[i]!.mistakeReason;
      if (reason) await attempts.patchItem(id, i, { mistakeReason: reason });
    }
    have.add(key);
    r.attempts += 1;
  }
}
