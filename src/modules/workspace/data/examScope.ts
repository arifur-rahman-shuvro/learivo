import { DEFAULT_QUERY, type QuestionRepo } from "../../question-bank/data/repo.ts";

const PAGE = 500;

/**
 * How many active questions an exam covers and how many of them were practised at least once.
 * No chosen subjects means the whole bank.
 */
export async function examScope(
  bank: Pick<QuestionRepo, "list">,
  subjectIds: readonly string[],
  practised: ReadonlySet<string>,
): Promise<{ total: number; seen: number }> {
  if (subjectIds.length === 0) {
    const page = await bank.list({ ...DEFAULT_QUERY, limit: 1 });
    return { total: page.total, seen: practised.size };
  }
  const ids = new Set<string>();
  for (const nodeId of subjectIds) {
    for (let offset = 0; ; offset += PAGE) {
      const page = await bank.list({ ...DEFAULT_QUERY, nodeId, offset, limit: PAGE });
      for (const q of page.items) ids.add(q.id);
      if (page.items.length < PAGE) break;
    }
  }
  let seen = 0;
  for (const id of ids) if (practised.has(id)) seen += 1;
  return { total: ids.size, seen };
}
