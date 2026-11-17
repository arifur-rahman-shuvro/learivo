/**
 * Finds questions that say the same thing in slightly different words. The database and the
 * import check already catch identical wording; this catches the rest: changed punctuation or
 * numbering, accents, a word added or dropped, and the same options under a reworded stem.
 *
 * It is deliberately careful about false alarms. Two stems that differ by a negation ("which is
 * NOT...") or by a number are different questions however alike they look, so they never match.
 */

export interface Comparable {
  id: string;
  stem: string;
  qtype: string;
  /** Option texts (or accepted answers for fill-in-the-blank). Empty when there are none. */
  options: string[];
}

export type MatchKind = "exact" | "near";

export interface Match {
  kind: MatchKind;
  /** 0 to 1: how alike the statements are. */
  score: number;
  /** 0 to 1: how alike the options are, or null when neither question has options. */
  optionScore: number | null;
  /** One plain sentence for the student. */
  why: string;
}

const STOP = new Set(
  "a an the of in on at to for and or is are was were be been being which what who whom whose that this these those with by from as it its into than then there their they he she we you your do does did has have had can could should would may might will shall following one ones also".split(
    " ",
  ),
);

const NEGATIONS = new Set([
  "not",
  "no",
  "none",
  "never",
  "neither",
  "nor",
  "except",
  "cannot",
  "cant",
  "false",
  "incorrect",
  "wrong",
  "non",
  "without",
  "unlikely",
  "least",
  "না",
  "নয়",
  "নেই",
  "নন",
  "ছাড়া",
  "ভুল",
]);

/** Lower case, accents and punctuation removed, leading "1." or "Q2)" numbering dropped. */
export function canon(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/^\s*(?:q(?:uestion)?\s*)?\d{1,3}\s*[.):-]\s+/u, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same rule for "is this the same statement": equal after `canon`, and the same type. */
export function canonKey(stem: string, qtype: string): string {
  return `${canon(stem)}|${qtype}`;
}

const tokensOf = (text: string): string[] => canon(text).split(" ").filter(Boolean);
export const contentTokens = (text: string): string[] => tokensOf(text).filter((t) => !STOP.has(t));

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** True when the two token sets differ by a negation or a number, which changes the meaning. */
function meaningChanged(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  for (const t of sa) if (!sb.has(t) && (NEGATIONS.has(t) || /\d/.test(t))) return true;
  for (const t of sb) if (!sa.has(t) && (NEGATIONS.has(t) || /\d/.test(t))) return true;
  return false;
}

function statementScore(a: Comparable, b: Comparable): number {
  const ca = contentTokens(a.stem);
  const cb = contentTokens(b.stem);
  // Too few content words to judge by overlap of the long kind: compare every word instead.
  if (ca.length < 3 || cb.length < 3)
    return jaccard(new Set(tokensOf(a.stem)), new Set(tokensOf(b.stem)));
  return jaccard(new Set(ca), new Set(cb));
}

function optionScore(a: Comparable, b: Comparable): number | null {
  if (a.options.length === 0 || b.options.length === 0) return null;
  return jaccard(new Set(a.options.map(canon)), new Set(b.options.map(canon)));
}

/** How two questions relate, or null when they are different questions. */
export function compare(a: Comparable, b: Comparable): Match | null {
  if (a.qtype !== b.qtype) return null;
  const same = canon(a.stem) === canon(b.stem);
  const opts = optionScore(a, b);
  if (same) {
    return {
      kind: "exact",
      score: 1,
      optionScore: opts,
      why:
        a.stem.trim().toLowerCase() === b.stem.trim().toLowerCase()
          ? "The same statement."
          : "The same statement apart from punctuation, spacing or numbering.",
    };
  }
  if (meaningChanged(tokensOf(a.stem), tokensOf(b.stem))) return null;
  const score = statementScore(a, b);
  if (score >= 0.8) {
    return { kind: "near", score, optionScore: opts, why: "Very similar wording." };
  }
  if (score >= 0.7 && opts !== null && opts >= 0.6) {
    return {
      kind: "near",
      score,
      optionScore: opts,
      why: "Similar wording and mostly the same options.",
    };
  }
  if (score >= 0.55 && opts !== null && opts >= 0.9 && a.options.length >= 3) {
    return {
      kind: "near",
      score,
      optionScore: opts,
      why: "The same options under a reworded statement.",
    };
  }
  return null;
}

/** Lets a question be compared with a large bank without checking every pair. */
export class SimilarityIndex {
  private readonly postings = new Map<string, number[]>();
  private readonly tokens: Set<string>[];

  constructor(private readonly items: readonly Comparable[]) {
    this.tokens = items.map((q) => new Set(contentTokens(q.stem)));
    this.tokens.forEach((set, i) => {
      for (const t of set) {
        const list = this.postings.get(t) ?? [];
        list.push(i);
        this.postings.set(t, list);
      }
    });
  }

  /** Indexes of items that share enough words with `q` to be worth comparing. */
  private candidates(q: Comparable): number[] {
    const mine = new Set(contentTokens(q.stem));
    const counts = new Map<number, number>();
    for (const t of mine) {
      const list = this.postings.get(t);
      if (!list || list.length > 300) continue; // words in a huge share of questions say little
      for (const j of list) counts.set(j, (counts.get(j) ?? 0) + 1);
    }
    const need = Math.max(2, Math.ceil(Math.min(mine.size, 6) * 0.5));
    const out: number[] = [];
    for (const [j, n] of counts) {
      const theirs = this.tokens[j]!.size;
      if (n >= Math.min(need, theirs) || mine.size < 3 || theirs < 3) out.push(j);
    }
    return out;
  }

  /** Every earlier-or-later item that matches `q`, best first. Never returns `q` itself. */
  matches(q: Comparable): { item: Comparable; match: Match }[] {
    const found: { item: Comparable; match: Match }[] = [];
    for (const j of this.candidates(q)) {
      const item = this.items[j]!;
      if (item.id === q.id) continue;
      const match = compare(q, item);
      if (match) found.push({ item, match });
    }
    return found.sort(
      (x, y) =>
        Number(y.match.kind === "exact") - Number(x.match.kind === "exact") ||
        y.match.score - x.match.score,
    );
  }
}

export interface SimilarPair {
  a: Comparable;
  b: Comparable;
  match: Match;
}

/** Pairs inside one list that look like the same question. Each pair appears once, best first. */
export function findSimilarPairs(items: readonly Comparable[]): SimilarPair[] {
  const index = new SimilarityIndex(items);
  const order = new Map(items.map((q, i) => [q.id, i]));
  const out: SimilarPair[] = [];
  for (const a of items) {
    for (const { item: b, match } of index.matches(a)) {
      if (order.get(a.id)! < order.get(b.id)!) out.push({ a, b, match });
    }
  }
  return out.sort(
    (x, y) =>
      Number(y.match.kind === "exact") - Number(x.match.kind === "exact") ||
      y.match.score - x.match.score ||
      x.a.stem.localeCompare(y.a.stem),
  );
}

/** Option texts of a stored question, for comparison. */
export function optionTexts(answer: unknown): string[] {
  const a = (answer ?? {}) as {
    options?: { text?: unknown }[];
    blanks?: { accepted?: unknown[] }[];
  };
  if (Array.isArray(a.options))
    return a.options.flatMap((o) => (typeof o.text === "string" ? [o.text] : []));
  if (Array.isArray(a.blanks))
    return a.blanks.flatMap((b) =>
      Array.isArray(b.accepted) ? b.accepted.filter((x): x is string => typeof x === "string") : [],
    );
  return [];
}

export function toComparable(q: {
  id: string;
  stem: string;
  qtype: string;
  answer: unknown;
}): Comparable {
  return { id: q.id, stem: q.stem, qtype: q.qtype, options: optionTexts(q.answer) };
}
