/** Numbers for the Insights and Home screens, worked out from finished sessions. */

/** One answered question from a finished session. Skipped questions are not facts. */
export interface Fact {
  /** ISO time the session was handed in. */
  at: string;
  path: string[];
  correct: boolean;
}

export interface SessionSummary {
  kind: "practice" | "exam";
  title: string;
  submittedAt: string;
  questionCount: number;
  marksCorrect: number;
  score: number;
  secondsSpent: number;
  answered: number;
  correct: number;
}

/** "2026-11-13" in the student's own time zone. */
export function dayKey(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y!, m! - 1, d! + days));
}

export interface AreaStat {
  name: string;
  correct: number;
  total: number;
  accuracy: number;
}

/** Accuracy per subject (depth 1) or per subject and chapter (depth 2), weakest first. */
export function byArea(facts: readonly Fact[], depth: 1 | 2 = 1): AreaStat[] {
  const map = new Map<string, { correct: number; total: number }>();
  for (const f of facts) {
    const name = f.path.slice(0, depth).join(" › ") || "Unclassified";
    const row = map.get(name) ?? { correct: 0, total: 0 };
    row.total += 1;
    if (f.correct) row.correct += 1;
    map.set(name, row);
  }
  return [...map.entries()]
    .map(([name, r]) => ({ name, ...r, accuracy: r.correct / r.total }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total || a.name.localeCompare(b.name));
}

/** Areas with enough answers to judge, and an accuracy below `below`. */
export function weakAreas(facts: readonly Fact[], minAnswers = 5, below = 0.7, depth: 1 | 2 = 2) {
  return byArea(facts, depth).filter((a) => a.total >= minAnswers && a.accuracy < below);
}

export interface DayPoint {
  day: string;
  answered: number;
  correct: number;
  accuracy: number;
}

/** One point per day with activity, oldest first, for the last `days` days. */
export function accuracyByDay(facts: readonly Fact[], today: Date, days = 30): DayPoint[] {
  const from = shiftDay(dayKey(today), -(days - 1));
  const map = new Map<string, { answered: number; correct: number }>();
  for (const f of facts) {
    const day = dayKey(f.at);
    if (day < from) continue;
    const row = map.get(day) ?? { answered: 0, correct: 0 };
    row.answered += 1;
    if (f.correct) row.correct += 1;
    map.set(day, row);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, r]) => ({ day, ...r, accuracy: r.correct / r.answered }));
}

export function answeredOn(facts: readonly Fact[], day: Date): number {
  const key = dayKey(day);
  return facts.filter((f) => dayKey(f.at) === key).length;
}

/**
 * Days in a row with at least one answer, counting back from today. A streak that was alive
 * yesterday still counts today, so it is not shown as lost before the student has had a chance
 * to study.
 */
export function streak(activeDays: ReadonlySet<string>, today: Date): number {
  let key = dayKey(today);
  if (!activeDays.has(key)) key = shiftDay(key, -1);
  let n = 0;
  while (activeDays.has(key)) {
    n += 1;
    key = shiftDay(key, -1);
  }
  return n;
}

export function activeDaySet(
  sessions: readonly SessionSummary[],
  facts: readonly Fact[],
): Set<string> {
  return new Set([
    ...facts.map((f) => dayKey(f.at)),
    ...sessions.filter((s) => s.answered > 0).map((s) => dayKey(s.submittedAt)),
  ]);
}

export interface ExamPoint {
  title: string;
  at: string;
  percent: number;
}

/** Exam scores as a percentage of full marks, oldest first. */
export function examHistory(sessions: readonly SessionSummary[]): ExamPoint[] {
  return sessions
    .filter((s) => s.kind === "exam" && s.questionCount > 0)
    .map((s) => ({
      title: s.title,
      at: s.submittedAt,
      percent: Math.round((s.score / (s.questionCount * s.marksCorrect)) * 1000) / 10,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function studyTimeByDay(
  sessions: readonly SessionSummary[],
  today: Date,
  days = 14,
): { day: string; seconds: number }[] {
  const out: { day: string; seconds: number }[] = [];
  const start = shiftDay(dayKey(today), -(days - 1));
  const sums = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(s.submittedAt);
    sums.set(k, (sums.get(k) ?? 0) + s.secondsSpent);
  }
  for (let i = 0; i < days; i++) {
    const day = shiftDay(start, i);
    out.push({ day, seconds: sums.get(day) ?? 0 });
  }
  return out;
}

export function overall(facts: readonly Fact[]) {
  const correct = facts.filter((f) => f.correct).length;
  return {
    answered: facts.length,
    correct,
    accuracy: facts.length === 0 ? null : correct / facts.length,
  };
}
