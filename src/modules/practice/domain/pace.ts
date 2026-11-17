/** How a student's time was spent across one session. */

export interface PaceItem {
  position: number;
  seconds: number;
  verdict: "correct" | "partial" | "wrong" | "unanswered" | null;
}

export interface Pace {
  /** Questions that have a recorded time. */
  timed: number;
  average: number;
  median: number;
  /** The slowest questions, slowest first, only those clearly above the median. */
  slowest: { position: number; seconds: number }[];
  /** Average seconds on right and on wrong answers, when there are enough of each to compare. */
  rightAverage: number | null;
  wrongAverage: number | null;
  /** Wrong answers given in a few seconds: probably guesses or slips. */
  rushedWrong: number;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Returns null when no question has a recorded time (older sessions, or none opened). */
export function paceOf(items: readonly PaceItem[]): Pace | null {
  const timed = items.filter((i) => i.seconds > 0);
  if (timed.length === 0) return null;
  const sorted = timed.map((i) => i.seconds).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const slowest = [...timed]
    .sort((a, b) => b.seconds - a.seconds || a.position - b.position)
    .filter((i) => i.seconds >= Math.max(20, median * 2))
    .slice(0, 3)
    .map((i) => ({ position: i.position, seconds: i.seconds }));
  const right = timed.filter((i) => i.verdict === "correct").map((i) => i.seconds);
  const wrong = timed.filter((i) => i.verdict === "wrong").map((i) => i.seconds);
  const quick = Math.max(5, median / 3);
  return {
    timed: timed.length,
    average: avg(sorted),
    median,
    slowest,
    rightAverage: right.length >= 2 && wrong.length >= 2 ? avg(right) : null,
    wrongAverage: right.length >= 2 && wrong.length >= 2 ? avg(wrong) : null,
    rushedWrong: timed.filter((i) => i.verdict === "wrong" && i.seconds <= quick).length,
  };
}

/** "45 s" or "1 min 5 s". */
export function shortTime(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 === 0 ? `${m} min` : `${m} min ${s % 60} s`;
}

/** One plain sentence about the session's pace, or null when there is nothing worth saying. */
export function paceNote(p: Pace): string | null {
  if (p.rightAverage !== null && p.wrongAverage !== null) {
    if (p.wrongAverage >= p.rightAverage * 1.5)
      return `You spent longer on the questions you got wrong (${shortTime(p.wrongAverage)} on average, against ${shortTime(p.rightAverage)} on right ones). Those were the hard ones, so they are worth revising.`;
    if (p.wrongAverage <= p.rightAverage * 0.6 && p.rushedWrong >= 2)
      return `${p.rushedWrong} wrong answers were given in a few seconds. Slow down on the first read of the question.`;
  }
  return null;
}
