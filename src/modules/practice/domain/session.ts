import type { QuestionRecord } from "../../question-bank/data/repo.ts";
import type { Confidence } from "./confidence.ts";
import type { Snapshot } from "./grading.ts";
import { inGroup, type MistakeGroup } from "./groups.ts";
import type { Reason } from "./reasons.ts";

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

/** Copies a question for a session. Options may be shuffled, except true/false statements, which keep their order. */
export function snapshotOf(
  q: QuestionRecord,
  path: string[],
  shuffleOptions: boolean,
  rand: () => number = Math.random,
): Snapshot {
  const answer =
    shuffleOptions && q.qtype !== "true_false" && "options" in q.answer
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
export type PracticeFilter =
  "all" | "unattempted" | "bookmarked" | "incorrect" | Exclude<MistakeGroup, "wrong">;

export interface Past {
  /** Result of the most recent graded answer to this question. */
  last: "correct" | "wrong";
  times: number;
  /** The reason the student gave for the latest answer, when it was wrong. */
  reason?: Reason | null;
  /** How sure the student was on the latest answer. */
  confidence?: Confidence | null;
}

export function applyFilter(
  pool: readonly QuestionRecord[],
  filter: PracticeFilter,
  past: ReadonlyMap<string, Past>,
  bookmarks: ReadonlySet<string> = new Set(),
): QuestionRecord[] {
  if (filter === "bookmarked") return pool.filter((q) => bookmarks.has(q.id));
  if (filter === "unattempted") return pool.filter((q) => !past.has(q.id));
  if (filter === "all") return [...pool];
  const group = filter === "incorrect" ? "wrong" : filter;
  return pool.filter((q) => inGroup(past.get(q.id), group));
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

/** The kinds of question a smart session mixes. A question appears under the first group it fits. */
export interface SmartPools {
  /** Revision cards that are due. */
  due: readonly string[];
  /** Questions from the student's weak areas. */
  weak: readonly string[];
  /** Not attempted yet. */
  fresh: readonly string[];
  /** Everything else, used to fill up. */
  rest: readonly string[];
}

/**
 * A study session that fits the day: about 40% revision that is due, 35% weak areas and 25% new
 * questions. A group that has too few hands its share to the others, so the session is as full as
 * the bank allows. `pick` chooses within a group (random in the app, fixed in tests).
 */
export function composeSmart(
  pools: SmartPools,
  count: number,
  pick: <T>(items: readonly T[]) => T[] = shuffled,
): string[] {
  const used = new Set<string>();
  const take = (ids: readonly string[], n: number) => {
    const out: string[] = [];
    for (const id of pick(ids)) {
      if (out.length >= n) break;
      if (used.has(id)) continue;
      used.add(id);
      out.push(id);
    }
    return out;
  };
  const dueN = Math.round(count * 0.4);
  const weakN = Math.round(count * 0.35);
  const out = [
    ...take(pools.due, dueN),
    ...take(pools.weak, weakN),
    ...take(pools.fresh, count - dueN - weakN),
  ];
  for (const group of [pools.due, pools.weak, pools.fresh, pools.rest]) {
    if (out.length >= count) break;
    out.push(...take(group, count - out.length));
  }
  return pick(out);
}

/** Share of a mixed session that comes from the subjects of the student's coming exam. */
export const EXAM_FOCUS_SHARE = 0.5;

/**
 * Picks `count` items so that about `share` of them satisfy `isFocus`. Other items still appear.
 * When one side has too few, the other side fills the session, so it is as full as the pool allows.
 */
export function focusedDraw<T>(
  items: readonly T[],
  count: number,
  isFocus: (item: T) => boolean,
  share: number = EXAM_FOCUS_SHARE,
  rand: () => number = Math.random,
): T[] {
  const focus = shuffled(items.filter(isFocus), rand);
  const other = shuffled(
    items.filter((x) => !isFocus(x)),
    rand,
  );
  const want = Math.round(count * share);
  const f = focus.slice(0, want);
  const o = other.slice(0, count - f.length);
  const out = [...f, ...o];
  if (out.length < count) out.push(...focus.slice(f.length, f.length + count - out.length));
  return shuffled(out, rand);
}

/** Like `composeSmart`, with about `share` of the session taken from the questions `isFocus` accepts. */
export function composeSmartFocused(
  pools: SmartPools,
  count: number,
  isFocus: (id: string) => boolean,
  share: number = EXAM_FOCUS_SHARE,
  pick: <T>(items: readonly T[]) => T[] = shuffled,
): string[] {
  const only = (keep: boolean): SmartPools => ({
    due: pools.due.filter((id) => isFocus(id) === keep),
    weak: pools.weak.filter((id) => isFocus(id) === keep),
    fresh: pools.fresh.filter((id) => isFocus(id) === keep),
    rest: pools.rest.filter((id) => isFocus(id) === keep),
  });
  const f = composeSmart(only(true), Math.round(count * share), pick);
  const o = composeSmart(only(false), count - f.length, pick);
  const out = [...f, ...o];
  if (out.length < count) {
    const used = new Set(out);
    const more = composeSmart(only(true), count, pick).filter((id) => !used.has(id));
    out.push(...more.slice(0, count - out.length));
  }
  return pick(out);
}
