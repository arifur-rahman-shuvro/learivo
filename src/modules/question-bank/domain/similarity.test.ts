import { describe, expect, it } from "vitest";
import {
  canon,
  canonKey,
  compare,
  findSimilarPairs,
  SimilarityIndex,
  type Comparable,
} from "./similarity.ts";

const q = (id: string, stem: string, options: string[] = [], qtype = "sba"): Comparable => ({
  id,
  stem,
  qtype,
  options,
});
const OPT = ["Axillary nerve", "Radial nerve", "Ulnar nerve", "Median nerve"];

describe("canon", () => {
  it("ignores case, punctuation, accents, spacing and leading numbering", () => {
    expect(canon("  1.  Which nerve supplies the DELTOID?? ")).toBe(
      "which nerve supplies the deltoid",
    );
    expect(canon("Q12) Café   au lait")).toBe("cafe au lait");
    expect(canonKey("A, b!", "sba")).toBe(canonKey("a b", "sba"));
    expect(canonKey("a b", "sba")).not.toBe(canonKey("a b", "true_false"));
  });
});

describe("compare", () => {
  it("calls a statement that differs only in punctuation exact", () => {
    const m = compare(
      q("1", "Which nerve supplies the deltoid?"),
      q("2", "1. Which nerve supplies the deltoid"),
    );
    expect(m?.kind).toBe("exact");
  });
  it("finds near copies with a word added", () => {
    const m = compare(
      q("1", "Which nerve supplies the deltoid muscle of the shoulder?", OPT),
      q("2", "Which nerve supplies the deltoid muscle of the shoulder joint?", OPT),
    );
    expect(m?.kind).toBe("near");
    expect(m!.score).toBeGreaterThanOrEqual(0.8);
  });
  it("finds the same options under a reworded statement", () => {
    const m = compare(
      q("1", "Injury to which nerve causes wrist drop after a humeral shaft fracture", [
        "Radial nerve",
        "Ulnar nerve",
        "Median nerve",
        "Axillary nerve",
      ]),
      q("2", "A humeral shaft fracture with wrist drop damages which nerve", [
        "Axillary nerve",
        "Median nerve",
        "Radial nerve",
        "Ulnar nerve",
      ]),
    );
    expect(m?.kind).toBe("near");
  });
  it("never matches when a negation or a number differs", () => {
    expect(
      compare(
        q("1", "Which of the following is a branch of the facial nerve in the parotid gland", OPT),
        q(
          "2",
          "Which of the following is NOT a branch of the facial nerve in the parotid gland",
          OPT,
        ),
      ),
    ).toBeNull();
    expect(
      compare(
        q("1", "The normal adult heart rate at rest is between 60 and 100 beats per minute"),
        q("2", "The normal adult heart rate at rest is between 40 and 100 beats per minute"),
      ),
    ).toBeNull();
  });
  it("treats different types and unrelated questions as different", () => {
    expect(
      compare(
        q("1", "Same words here today", [], "sba"),
        q("2", "Same words here today", [], "true_false"),
      ),
    ).toBeNull();
    expect(
      compare(
        q("1", "Which nerve supplies the deltoid muscle", OPT),
        q("2", "Which artery supplies the appendix", OPT),
      ),
    ).toBeNull();
  });
  it("handles Bangla statements", () => {
    const m = compare(
      q("1", "হৃৎপিণ্ডের কোন কপাটিকা বাম অলিন্দ ও নিলয়ের মাঝে থাকে?"),
      q("2", "হৃৎপিণ্ডের কোন কপাটিকা বাম অলিন্দ ও নিলয়ের মাঝে থাকে"),
    );
    expect(m?.kind).toBe("exact");
  });
});

describe("findSimilarPairs", () => {
  const bank = [
    q("a", "Which nerve supplies the deltoid muscle of the shoulder?", OPT),
    q("b", "Which nerve supplies the deltoid muscle of the shoulder joint?", OPT),
    q("c", "Which artery supplies the appendix?", ["SMA", "IMA", "Coeliac"]),
    q("d", "which artery supplies the appendix", ["SMA", "IMA", "Coeliac"]),
    q("e", "Name the largest organ of the human body"),
  ];
  it("lists each pair once, exact first", () => {
    const pairs = findSimilarPairs(bank);
    expect(pairs.map((p) => [p.a.id, p.b.id, p.match.kind])).toEqual([
      ["c", "d", "exact"],
      ["a", "b", "near"],
    ]);
  });
  it("a bank without repeats gives no pairs", () => {
    expect(findSimilarPairs([bank[0]!, bank[2]!, bank[4]!])).toEqual([]);
  });
  it("an index finds matches for a new question without listing itself", () => {
    const index = new SimilarityIndex(bank);
    const hits = index.matches(
      q("new", "Which nerve supplies the deltoid muscle of the shoulder?", OPT),
    );
    expect(hits.map((h) => h.item.id).sort()).toEqual(["a", "b"]);
  });
  it("stays fast on a few thousand questions", () => {
    const many = Array.from({ length: 3000 }, (_, i) =>
      q(
        String(i),
        `Question about topic ${i} with unique term${i} alpha${i * 7} beta${i * 13} in medicine`,
      ),
    );
    const t = Date.now();
    findSimilarPairs(many);
    expect(Date.now() - t).toBeLessThan(5000);
  });
});
