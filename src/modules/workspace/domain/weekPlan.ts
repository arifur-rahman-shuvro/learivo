import { dayKey } from "./insights.ts";
import { daysUntil, studyPlan } from "./examTarget.ts";

export interface PlanDay {
  /** YYYY-MM-DD */
  day: string;
  /** "study": new questions and revision. "light": the day before the exam, revision only. "exam": the exam itself. */
  kind: "study" | "light" | "exam";
  /** New questions to practise (0 on light and exam days, or when everything has been practised). */
  fresh: number;
  /** Revision cards due that day. */
  revise: number;
}

/**
 * The next days up to the exam (at most 7) as a calendar. A rule of thumb, not a promise:
 * the questions not yet practised are spread over the days before the last one, the last day
 * before the exam is kept for revision only, and revision counts come from the cards already due.
 * Returns an empty list when the exam date is missing, today or in the past.
 */
export function weekPlan(
  examDate: string | null,
  total: number,
  seen: number,
  due: readonly { day: string; count: number }[],
  now: Date,
): PlanDay[] {
  if (!examDate) return [];
  const left = daysUntil(examDate, now);
  if (!(left > 0)) return [];
  const usable = Math.max(1, left - 1);
  const perDay = studyPlan(total, seen, usable).perDay ?? 0;
  const count = Math.min(7, left + 1);
  const start = dayKey(now);
  const [y, m, d] = start.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const day = dayKey(new Date(y!, m! - 1, d! + i));
    const revise = due.find((x) => x.day === day)?.count ?? 0;
    if (i === left) return { day, kind: "exam", fresh: 0, revise: 0 };
    if (i === left - 1) return { day, kind: "light", fresh: 0, revise };
    return { day, kind: "study", fresh: perDay, revise };
  });
}
