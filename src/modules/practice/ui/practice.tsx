import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AttemptRepo } from "../data/repo.ts";
import type { QuestionRecord, QuestionRepo, TaxonomyNode } from "../../question-bank/data/repo.ts";
import { DEFAULT_QUERY, subtreeIds } from "../../question-bank/data/repo.ts";

interface PracticeValue {
  attempts: AttemptRepo;
  /** Increases after every change so lists reload. */
  rev: number;
  refresh: () => void;
}

const Ctx = createContext<PracticeValue | null>(null);

export function PracticeProvider({
  attempts,
  children,
}: {
  attempts: AttemptRepo;
  children: ReactNode;
}) {
  const [rev, setRev] = useState(0);
  const value = useMemo(
    () => ({ attempts, rev, refresh: () => setRev((n) => n + 1) }),
    [attempts, rev],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePractice(): PracticeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePractice must be used inside PracticeProvider");
  return v;
}

/** Every active question that matches the source, read in pages of 500. */
export async function fetchPool(
  repo: QuestionRepo,
  source: { nodeId: string | null; tagId: string | null; collectionId: string | null },
): Promise<QuestionRecord[]> {
  const out: QuestionRecord[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const page = await repo.list({
      ...DEFAULT_QUERY,
      status: "active",
      nodeId: source.nodeId,
      tagId: source.tagId,
      collectionId: source.collectionId,
      offset,
      limit: 500,
    });
    out.push(...page.items);
    if (out.length >= page.total || page.items.length === 0) break;
  }
  return out;
}

/** True when the question sits under the node (or anywhere, when nodeId is null). */
export function makeInside(nodes: readonly TaxonomyNode[]) {
  const cache = new Map<string, Set<string>>();
  return (nodeId: string | null, q: QuestionRecord) => {
    if (nodeId === null) return true;
    if (q.nodeId === null) return false;
    let set = cache.get(nodeId);
    if (!set) {
      set = new Set(subtreeIds(nodeId, nodes));
      cache.set(nodeId, set);
    }
    return set.has(q.nodeId);
  };
}

export const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};
