import { describe, expect, it } from "vitest";
import { nodeIdForName } from "./start.ts";
import type { TaxonomyNode } from "../../question-bank/data/repo.ts";

const node = (id: string, parentId: string | null, name: string): TaxonomyNode => ({
  id,
  parentId,
  kind: parentId ? "chapter" : "subject",
  name,
  position: 0,
});

describe("nodeIdForName", () => {
  const nodes = [
    node("a", null, "Anatomy"),
    node("h", "a", "Heart"),
    node("p", null, "Physiology"),
  ];
  it("finds a subject and a chapter", () => {
    expect(nodeIdForName(nodes, "Anatomy")).toBe("a");
    expect(nodeIdForName(nodes, "Anatomy › Heart")).toBe("h");
  });
  it("returns null for a missing or misplaced name", () => {
    expect(nodeIdForName(nodes, "Unclassified")).toBeNull();
    expect(nodeIdForName(nodes, "Physiology › Heart")).toBeNull();
  });
});
