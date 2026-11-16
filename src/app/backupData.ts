import type { QuestionRepo } from "../modules/question-bank/data/repo.ts";
import { DEFAULT_QUERY } from "../modules/question-bank/data/repo.ts";
import { contentHash } from "../modules/question-bank/domain/hash.ts";
import { analyzeImport, questionToRecord } from "../modules/question-bank/domain/importExport.ts";
import type { WorkspaceRepo } from "../modules/workspace/data/repo.ts";
import { cleanExamTarget, type ExamTarget } from "../modules/workspace/domain/examTarget.ts";
import { LIMITS } from "../modules/workspace/domain/cards.ts";

export const BACKUP_FORMAT = "learivo-backup";
export const DEFAULT_GOAL = 20;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  createdAt: string;
  questions: Record<string, unknown>[];
  /** Notes point at a question by its content hash, so they survive a restore into another account. */
  notes: { questionHash: string | null; title: string; body: string }[];
  bookmarks: string[];
  flashcards: { front: string; back: string }[];
  glossary: { term: string; definition: string }[];
  examTarget: ExamTarget;
  dailyGoal: number;
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

export async function buildBackup(bank: QuestionRepo, ws: WorkspaceRepo): Promise<Backup> {
  const [hashes, questions, notes, bookmarks, flashcards, glossary, examTarget, dailyGoal] =
    await Promise.all([
      idsAndHashes(bank),
      bank.exportAll(),
      ws.notes(),
      ws.bookmarks(),
      ws.flashcards(),
      ws.glossary(),
      ws.examTarget(),
      ws.dailyGoal(),
    ]);
  return {
    format: BACKUP_FORMAT,
    version: 1,
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
  };
}

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: string };

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() !== "" && v.length <= max ? v : null;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

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
  if (o.version !== 1) return { ok: false, error: "This backup was made by a newer version." };
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
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: 1,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
      questions: list(o.questions).map(obj),
      notes,
      bookmarks: list(o.bookmarks).filter((h): h is string => typeof h === "string"),
      flashcards,
      glossary,
      examTarget: cleanExamTarget(o.examTarget),
      dailyGoal: Number.isInteger(goal) && goal >= 1 && goal <= 500 ? goal : DEFAULT_GOAL,
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
  } catch (e) {
    r.failure = e instanceof Error ? e.message : "Something went wrong.";
  }
  return r;
}
