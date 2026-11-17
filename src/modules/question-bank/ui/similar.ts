import { DEFAULT_QUERY, type QuestionRepo } from "../data/repo.ts";
import { compare, contentTokens, toComparable, type Comparable } from "../domain/similarity.ts";

/** Every active question in the bank, in the shape the similarity check needs. */
export async function loadComparables(repo: QuestionRepo): Promise<Comparable[]> {
  const out: Comparable[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = await repo.list({ ...DEFAULT_QUERY, offset, limit: 200 });
    out.push(...page.items.map(toComparable));
    if (page.items.length < 200) break;
  }
  return out;
}

/** Words worth searching for: the longest few content words of a statement. */
function searchWords(stem: string): string {
  return [...new Set(contentTokens(stem))]
    .filter((t) => t.length >= 4 && !/\d/.test(t))
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .join(" ");
}

/** The closest existing question to a statement being typed, or null. Asks the bank for a few candidates only. */
export async function findSimilarInBank(
  repo: QuestionRepo,
  draft: { stem: string; qtype: string; answer: unknown },
  excludeId: string | null,
): Promise<{ stem: string; why: string } | null> {
  const search = searchWords(draft.stem);
  if (!search) return null;
  const page = await repo.list({ ...DEFAULT_QUERY, search, limit: 30 });
  const mine = toComparable({ id: "draft", ...draft });
  let best: { stem: string; why: string; score: number } | null = null;
  for (const q of page.items) {
    if (q.id === excludeId) continue;
    const m = compare(mine, toComparable(q));
    if (m && (!best || m.score > best.score)) best = { stem: q.stem, why: m.why, score: m.score };
  }
  return best ? { stem: best.stem, why: best.why } : null;
}
