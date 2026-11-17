import { describe, expect, it } from "vitest";
import { findDuplicates } from "./duplicates.ts";

const q = (id: string, stem: string, createdAt: string, tagIds: string[] = []) => ({
  id,
  stem,
  qtype: "sba",
  createdAt,
  tagIds,
  collectionIds: [] as string[],
});

describe("findDuplicates", () => {
  it("keeps the oldest copy and moves tags the others carry", () => {
    const groups = findDuplicates([
      q("b", "What is  2+2?", "2026-02-01", ["t2"]),
      q("a", "what is 2+2?", "2026-01-01", ["t1"]),
      q("c", "Something else", "2026-01-05"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.keep.id).toBe("a");
    expect(groups[0]!.extras.map((e) => e.id)).toEqual(["b"]);
    expect(groups[0]!.moveTags).toEqual(["t2"]);
  });

  it("finds nothing when every question differs", () => {
    expect(findDuplicates([q("a", "One", "1"), q("b", "Two", "2")])).toEqual([]);
  });
});

describe("pairToGroup", () => {
  const mk = (id: string, createdAt: string, tagIds: string[], collectionIds: string[] = []) => ({
    id,
    stem: id,
    qtype: "sba",
    createdAt,
    tagIds,
    collectionIds,
  });
  it("keeps the older question and moves what only the newer one has", async () => {
    const { pairToGroup, pairKey } = await import("./duplicates.ts");
    const old = mk("a", "2026-01-01", ["t1"]);
    const fresh = mk("b", "2026-02-01", ["t1", "t2"], ["c1"]);
    for (const g of [pairToGroup(old, fresh), pairToGroup(fresh, old)]) {
      expect(g.keep.id).toBe("a");
      expect(g.extras.map((e) => e.id)).toEqual(["b"]);
      expect(g.moveTags).toEqual(["t2"]);
      expect(g.moveCollections).toEqual(["c1"]);
    }
    expect(pairKey("b", "a")).toBe(pairKey("a", "b"));
  });
});
