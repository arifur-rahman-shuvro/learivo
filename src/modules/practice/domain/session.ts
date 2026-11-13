import type { QuestionRecord } from "../../question-bank/data/repo.ts";
import type { Snapshot } from "./grading.ts";

/** Small deterministic random generator, so a draw can be repeated in tests. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Copies a question for a session. Options may be shuffled; true or false stays as is. */
export function snapshotOf(
  q: QuestionRecord,
  path: string[],
  shuffleOptions: boolean,
  rand: () => number = Math.random,
): Snapshot {
  const answer =
    shuffleOptions && "options" in q.answer
      ? { options: shuffled(q.answer.options, rand) }
      : q.answer;
  return {
    qtype: q.qtype,
    stem: q.stem,
    explanation: q.explanation,
    answer,
    difficulty: q.difficulty,
    path,
  };
}

/** Which questions a practice session may draw from, beyond the subject, tag or collection. */
export type PracticeFilter = "all" | "unattempted" | "incorrect";

export interface Past {
  /** Result of the most recent graded answer to this question. */
  last: "correct" | "wrong";
  times: number;
}

export function applyFilter(
  pool: readonly QuestionRecord[],
  filter: PracticeFilter,
  past: ReadonlyMap<string, Past>,
): QuestionRecord[] {
  if (filter === "unattempted") return pool.filter((q) => !past.has(q.id));
  if (filter === "incorrect") return pool.filter((q) => past.get(q.id)?.last === "wrong");
  return [...pool];
}

/** One exam rule: take `count` questions from a subject (or from everything when nodeId is null). */
export interface ExamRule {
  nodeId: string | null;
  count: number;
}

export interface RuleCheck {
  rule: ExamRule;
  available: number;
  short: boolean;
}

/** Tells the builder how many questions each rule can really get. Rules are drawn in order. */
export function checkRules(
  rules: readonly ExamRule[],
  pool: readonly QuestionRecord[],
  inside: (nodeId: string | null, q: QuestionRecord) => boolean,
): RuleCheck[] {
  const used = new Set<string>();
  return rules.map((rule) => {
    const free = pool.filter((q) => !used.has(q.id) && inside(rule.nodeId, q));
    free.slice(0, rule.count).forEach((q) => used.add(q.id));
    return { rule, available: free.length, short: free.length < rule.count };
  });
}

/** Draws questions for an exam by its rules. Never repeats a question. */
export function drawByRules(
  rules: readonly ExamRule[],
  pool: readonly QuestionRecord[],
  inside: (nodeId: string | null, q: QuestionRecord) => boolean,
  rand: () => number = Math.random,
): QuestionRecord[] {
  const used = new Set<string>();
  const picked: QuestionRecord[] = [];
  for (const rule of rules) {
    const free = shuffled(
      pool.filter((q) => !used.has(q.id) && inside(rule.nodeId, q)),
      rand,
    ).slice(0, rule.count);
    free.forEach((q) => used.add(q.id));
    picked.push(...free);
  }
  return picked;
}
