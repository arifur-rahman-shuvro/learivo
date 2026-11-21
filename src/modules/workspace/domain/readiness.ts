import type { Fact } from "./insights.ts";

/**
 * Readiness and study allocation, worked out only from the student's own finished answers.
 *
 * Readiness is an estimate of how likely the student is to answer a question from their own bank
 * correctly today. It is NOT a prediction of an exam mark: the bank is not the exam, and the
 * estimate says so by showing a range and by staying quiet when there are too few answers.
 */

/** Recent answers count more: an answer loses half its weight every this many days. */
export const HALF_LIFE_DAYS = 21;
/** Fewer answers than this overall and no estimate is shown. */
export const MIN_ANSWERS = 20;
/** An area needs at least this many answers to be called weak or strong. */
export const MIN_AREA_ANSWERS = 5;

const DAY = 86_400_000;
const Z = 1.28; // about an 80% range

/** Weighted share correct, with an approximate 80% range (Wilson interval on the weighted count). */
function range(correct: number, total: number) {
  if (total <= 0) return { p: 0, low: 0, high: 1 };
  const p = correct / total;
  const z2 = Z * Z;
  const centre = (p + z2 / (2 * total)) / (1 + z2 / total);
  const half = (Z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / (1 + z2 / total);
  return { p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export interface AreaReadiness {
  name: string;
  /** Answers given (not weighted). */
  answers: number;
  /** Recent-weighted share correct, 0 to 1. */
  estimate: number;
  low: number;
  high: number;
  /** Days since the last answer in this area. */
  daysSince: number;
}

export type ReadinessLevel = "none" | "early" | "fair";

export interface Readiness {
  level: ReadinessLevel;
  answers: number;
  estimate: number | null;
  low: number | null;
  high: number | null;
  areas: AreaReadiness[];
}

function weightOf(at: string, now: Date): number {
  const age = Math.max(0, (now.getTime() - new Date(at).getTime()) / DAY);
  return Math.pow(0.5, age / HALF_LIFE_DAYS);
}

export function readiness(facts: readonly Fact[], now: Date, depth: 1 | 2 = 1): Readiness {
  const map = new Map<string, { c: number; t: number; n: number; last: number }>();
  let c = 0;
  let t = 0;
  for (const f of facts) {
    const w = weightOf(f.at, now);
    const name = f.path.slice(0, depth).join(" › ") || "Unclassified";
    const row = map.get(name) ?? { c: 0, t: 0, n: 0, last: 0 };
    row.t += w;
    row.n += 1;
    if (f.correct) row.c += w;
    row.last = Math.max(row.last, new Date(f.at).getTime());
    map.set(name, row);
    t += w;
    if (f.correct) c += w;
  }
  const areas: AreaReadiness[] = [...map.entries()]
    .map(([name, r]) => {
      const x = range(r.c, r.t);
      return {
        name,
        answers: r.n,
        estimate: x.p,
        low: x.low,
        high: x.high,
        daysSince: Math.max(0, Math.floor((now.getTime() - r.last) / DAY)),
      };
    })
    .sort((a, b) => a.estimate - b.estimate || b.answers - a.answers);
  const answers = facts.length;
  if (answers < MIN_ANSWERS) {
    return { level: "none", answers, estimate: null, low: null, high: null, areas };
  }
  const x = range(c, t);
  return {
    level: answers < 60 ? "early" : "fair",
    answers,
    estimate: x.p,
    low: x.low,
    high: x.high,
    areas,
  };
}

export interface Allocation {
  name: string;
  questions: number;
  /** Plain reasons this area got its share. */
  why: string[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Plain reasons for an area's share, from numbers the student can see on Insights. */
export function explain(a: AreaReadiness): string[] {
  const why: string[] = [];
  if (a.answers < MIN_AREA_ANSWERS) {
    why.push(
      `Only ${a.answers} answer${a.answers === 1 ? "" : "s"} so far, so there is little to go on. A few more will show where you stand.`,
    );
  } else {
    why.push(
      `You get about ${pct(a.estimate)} right here (${a.answers} answers, recent ones count more).`,
    );
  }
  if (a.high - a.low > 0.35 && a.answers >= MIN_AREA_ANSWERS) {
    why.push("The range is wide, so this number could still move a lot.");
  }
  if (a.daysSince >= 14) {
    why.push(`You have not practised this for ${a.daysSince} days.`);
  }
  return why;
}

/**
 * Split a number of questions across areas. An area gets more when its accuracy is lower, and
 * more when there is less evidence (a wide range), so thinly tested areas are not ignored. At
 * most `maxAreas` areas are used and none gets a share below one question.
 */
export function allocate(r: Readiness, questions: number, maxAreas = 4): Allocation[] {
  if (questions <= 0 || r.areas.length === 0) return [];
  const need = r.areas
    .map((a) => ({
      a,
      // 1 - estimate is the gap; half the range width adds weight for uncertain areas.
      weight: Math.max(0.05, 1 - a.estimate) + (a.high - a.low) / 2,
    }))
    .sort((x, y) => y.weight - x.weight)
    .slice(0, Math.min(maxAreas, questions));
  const total = need.reduce((s, x) => s + x.weight, 0);
  const raw = need.map((x) => (x.weight / total) * questions);
  const base = raw.map((v) => Math.max(1, Math.floor(v)));
  let left = questions - base.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((p, q) => q[0] - p[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) base[order[k]![1]]! += 1;
  for (let i = base.length - 1; left < 0 && i >= 0; i--) {
    while (left < 0 && base[i]! > 1) {
      base[i]!--;
      left++;
    }
  }
  return need
    .map((x, i) => ({ name: x.a.name, questions: base[i]!, why: explain(x.a) }))
    .sort((a, b) => b.questions - a.questions);
}

/**
 * How many questions the plan covers: the student's own daily goal, raised a little as the exam
 * gets close (a quarter more inside 30 days, half more inside 7). A rule of thumb, shown to the
 * student with its reason; it is capped at 100 and never lowers the goal.
 */
export function planSize(
  goal: number,
  daysToExam: number | null,
): { questions: number; note: string | null } {
  const base = Math.max(5, Math.min(100, Math.round(goal)));
  if (daysToExam === null || daysToExam < 0 || daysToExam > 30)
    return { questions: base, note: null };
  if (daysToExam <= 7) {
    return {
      questions: Math.min(100, Math.ceil(base * 1.5)),
      note: `Your exam is in ${daysToExam} day${daysToExam === 1 ? "" : "s"}, so this is half more than your daily goal of ${base}.`,
    };
  }
  return {
    questions: Math.min(100, Math.ceil(base * 1.25)),
    note: `Your exam is in ${daysToExam} days, so this is a quarter more than your daily goal of ${base}.`,
  };
}
