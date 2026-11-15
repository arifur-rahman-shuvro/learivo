import { activeDaySet, dayKey, examHistory, overall } from "./insights.ts";
import type { Fact, SessionSummary } from "./insights.ts";

/** Milestones worked out from the student's own sessions. No scores are shared with anyone. */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  earned: boolean;
}

/** The longest run of consecutive active days ever. */
export function longestStreak(days: ReadonlySet<string>): number {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev !== null && nextDay(prev) === d) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

function nextDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y!, m! - 1, d! + 1));
}

const make = (
  id: string,
  title: string,
  description: string,
  current: number,
  target: number,
): Achievement => ({
  id,
  title,
  description,
  current: Math.min(current, target),
  target,
  earned: current >= target,
});

export function achievements(
  facts: readonly Fact[],
  sessions: readonly SessionSummary[],
): Achievement[] {
  const total = overall(facts);
  const best = longestStreak(activeDaySet(sessions, facts));
  const exams = sessions.filter((s) => s.kind === "exam");
  const topExam = Math.max(0, ...examHistory(sessions).map((p) => p.percent));
  const perfect = Math.max(
    0,
    ...sessions.filter((s) => s.answered >= 10 && s.correct === s.answered).map((s) => s.answered),
  );
  const accuracyBase =
    total.answered >= 100 ? Math.round((total.correct / total.answered) * 100) : 0;
  return [
    make("first", "First step", "Answer your first question.", total.answered, 1),
    make("hundred", "Hundred", "Answer 100 questions.", total.answered, 100),
    make("five-hundred", "Five hundred", "Answer 500 questions.", total.answered, 500),
    make("thousand", "One thousand", "Answer 1,000 questions.", total.answered, 1000),
    make("streak-3", "Three days running", "Study on 3 days in a row.", best, 3),
    make("streak-7", "A full week", "Study on 7 days in a row.", best, 7),
    make("streak-30", "A full month", "Study on 30 days in a row.", best, 30),
    make("first-exam", "First exam", "Finish a timed exam.", exams.length, 1),
    make("exam-80", "Exam 80", "Score 80% or more in an exam.", topExam, 80),
    make(
      "perfect",
      "Clean sheet",
      "Get every question right in a session of 10 or more.",
      perfect,
      10,
    ),
    make(
      "accuracy-80",
      "Steady hand",
      "Keep 80% accuracy across 100 or more answers.",
      accuracyBase,
      80,
    ),
  ];
}
