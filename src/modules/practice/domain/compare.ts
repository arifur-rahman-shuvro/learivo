import { percentOfTotal } from "./grading.ts";
import { shortTime } from "./pace.ts";

export interface Scored {
  score: number | null;
  questionCount: number;
  marksCorrect: number;
  secondsSpent: number;
  submittedAt: string | null;
}

const percentOf = (a: Scored) => percentOfTotal(a.score, a.questionCount, a.marksCorrect);

/** The most recent earlier finished attempt in the list, or null. */
export function previousAttempt<T extends Scored>(current: T, others: readonly T[]): T | null {
  if (!current.submittedAt) return null;
  const earlier = others
    .filter((o) => o !== current && o.submittedAt && o.submittedAt < current.submittedAt!)
    .sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!));
  return earlier[0] ?? null;
}

/** One plain sentence comparing two attempts of the same exam. */
export function compareSentence(current: Scored, previous: Scored): string {
  const diff = Math.round(percentOf(current) - percentOf(previous));
  const score =
    diff === 0
      ? "Same score as last time"
      : `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff)} point${Math.abs(diff) === 1 ? "" : "s"} from last time`;
  const dt = current.secondsSpent - previous.secondsSpent;
  if (current.secondsSpent <= 0 || previous.secondsSpent <= 0 || Math.abs(dt) < 30)
    return `${score}.`;
  return `${score}, and ${shortTime(Math.abs(dt))} ${dt < 0 ? "faster" : "slower"}.`;
}
