import { contentHash } from "./hash.ts";

interface Dupe {
  id: string;
  stem: string;
  qtype: string;
  createdAt: string;
  tagIds: string[];
  collectionIds: string[];
}

export interface DuplicateGroup<T extends Dupe = Dupe> {
  /** The oldest question: the one that stays. */
  keep: T;
  /** The extra copies. */
  extras: T[];
  /** Tags and collections the extras have that the kept question lacks. */
  moveTags: string[];
  moveCollections: string[];
}

/** Groups questions with the same wording and type. The oldest of each group is kept. */
export function findDuplicates<T extends Dupe>(questions: readonly T[]): DuplicateGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const q of questions) {
    const h = contentHash(q.stem, q.qtype);
    groups.set(h, [...(groups.get(h) ?? []), q]);
  }
  const out: DuplicateGroup<T>[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    const [keep, ...extras] = sorted as [T, ...T[]];
    const tags = new Set(keep.tagIds);
    const cols = new Set(keep.collectionIds);
    out.push({
      keep,
      extras,
      moveTags: [...new Set(extras.flatMap((e) => e.tagIds))].filter((t) => !tags.has(t)),
      moveCollections: [...new Set(extras.flatMap((e) => e.collectionIds))].filter(
        (c) => !cols.has(c),
      ),
    });
  }
  return out.sort((a, b) => a.keep.stem.localeCompare(b.keep.stem));
}

/** Turns two questions that look alike into a group: the older stays, the newer is the extra. */
export function pairToGroup<T extends Dupe>(a: T, b: T): DuplicateGroup<T> {
  const [keep, extra] = sortedPair(a, b);
  return {
    keep,
    extras: [extra],
    moveTags: extra.tagIds.filter((t) => !keep.tagIds.includes(t)),
    moveCollections: extra.collectionIds.filter((c) => !keep.collectionIds.includes(c)),
  };
}

function sortedPair<T extends Dupe>(a: T, b: T): [T, T] {
  const order = a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  return order <= 0 ? [a, b] : [b, a];
}

/** A stable key for a pair, so "not a duplicate" can be remembered whichever order it comes in. */
export function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}
