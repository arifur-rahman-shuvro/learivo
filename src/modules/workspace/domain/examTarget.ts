/** The student's next exam: shown as a countdown on Home. */
export interface ExamTarget {
  title: string;
  /** YYYY-MM-DD, or null when no exam is set. */
  date: string | null;
}

export const NO_EXAM: ExamTarget = { title: "", date: null };

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
  const o = (raw && typeof raw === "object" ? raw : {}) as { title?: unknown; date?: unknown };
  const date =
    typeof o.date === "string" && !Number.isNaN(daysUntil(o.date, new Date())) ? o.date : null;
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";
  return date ? { title, date } : NO_EXAM;
}

/** About how many questions a day it takes to go through `count` questions before the exam. */
export function paceFor(count: number, days: number): number | null {
  if (count <= 0 || days <= 0) return null;
  return Math.ceil(count / days);
}
