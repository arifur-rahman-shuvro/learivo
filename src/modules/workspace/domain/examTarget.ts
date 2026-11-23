/** The student's next exam: shown as a countdown on Home. */
export interface ExamTarget {
  title: string;
  /** YYYY-MM-DD, or null when no exam is set. */
  date: string | null;
  /** Ids of the subjects this exam covers. Empty means every subject. */
  subjectIds: string[];
}

export const NO_EXAM: ExamTarget = { title: "", date: null, subjectIds: [] };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whole calendar days from today to the date. 0 is today, negative is in the past. */
export function daysUntil(date: string, now: Date): number {
  const m = DATE.exec(date);
  if (!m) return Number.NaN;
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function cleanExamTarget(raw: unknown): ExamTarget {
  const o = (raw && typeof raw === "object" ? raw : {}) as {
    title?: unknown;
    date?: unknown;
    subjectIds?: unknown;
  };
  const date =
    typeof o.date === "string" && !Number.isNaN(daysUntil(o.date, new Date())) ? o.date : null;
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";
  const subjectIds = Array.isArray(o.subjectIds)
    ? [
        ...new Set(o.subjectIds.filter((x): x is string => typeof x === "string" && x !== "")),
      ].slice(0, MAX_SUBJECTS)
    : [];
  return date ? { title, date, subjectIds } : { ...NO_EXAM, subjectIds: [] };
}

export const MAX_SUBJECTS = 100;

/** The chosen subjects that still exist. An empty result means the exam covers every subject. */
export function liveSubjects(chosen: readonly string[], existing: readonly string[]): string[] {
  const have = new Set(existing);
  return chosen.filter((id) => have.has(id));
}

/** About how many questions a day it takes to go through `count` questions before the exam. */
export function paceFor(count: number, days: number): number | null {
  if (count <= 0 || days <= 0) return null;
  return Math.ceil(count / days);
}

export interface StudyPlan {
  /** Questions never practised yet. */
  unseen: number;
  /** Share of the bank practised at least once, 0 to 100. */
  coverage: number;
  /** Questions a day that finish the unseen ones before the exam; null when nothing is left. */
  perDay: number | null;
}

/** Turns "days left" and "questions practised so far" into a daily quota. */
export function studyPlan(total: number, seen: number, days: number): StudyPlan {
  const done = Math.max(0, Math.min(total, Math.floor(seen)));
  const unseen = Math.max(0, total - done);
  return {
    unseen,
    coverage: total > 0 ? Math.round((done / total) * 100) : 0,
    perDay: paceFor(unseen, days),
  };
}
