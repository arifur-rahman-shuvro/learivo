import { describe, expect, it } from "vitest";
import { MemoryRepo } from "../data/memoryRepo.ts";
import { blankQuestion } from "../domain/model.ts";
import { findSimilarInBank, loadComparables } from "./similar.ts";

const sba = (stem: string) => ({
  ...blankQuestion("sba"),
  stem,
  answer: {
    options: [
      { text: "Axillary nerve", correct: true },
      { text: "Radial nerve", correct: false },
    ],
  },
});

describe("findSimilarInBank", () => {
  it("finds a reworded copy among the bank's candidates and ignores the question being edited", async () => {
    const repo = new MemoryRepo();
    await repo.create([
      sba("Which nerve supplies the deltoid muscle of the shoulder?"),
      sba("Which artery supplies the appendix?"),
    ]);
    const mine = sba("Which nerve supplies the deltoid muscle of the shoulder joint?");
    const hit = await findSimilarInBank(repo, mine, null);
    expect(hit?.stem).toBe("Which nerve supplies the deltoid muscle of the shoulder?");
    const id = (await loadComparables(repo)).find((q) => q.stem.includes("deltoid"))!.id;
    expect(await findSimilarInBank(repo, mine, id)).toBeNull();
    expect(
      await findSimilarInBank(repo, sba("Name the largest organ of the body"), null),
    ).toBeNull();
    expect(await findSimilarInBank(repo, sba("Hi"), null)).toBeNull();
  });
});
