import { describe, expect, it } from "vitest";
import { MemoryRepo } from "./modules/question-bank/data/memoryRepo.ts";
import { DEFAULT_QUERY } from "./modules/question-bank/data/repo.ts";
import { blankQuestion } from "./modules/question-bank/domain/model.ts";
import { buildPack, PackRepo } from "./platform/offline/pack.ts";
import { buildBackup } from "./account/backup/backupData.ts";
import { MemoryWorkspace } from "./modules/workspace/data/memoryWorkspace.ts";

/**
 * Large-bank guards. The budgets are about ten times what a normal machine needs, so they only
 * trip when something turns from linear into quadratic, not on a slow day.
 */
const N = 20_500; // beyond the 20,000 the offline copy once stopped at
const WORDS = ["heart", "femur", "renal", "insulin", "cranial", "nerve", "liver", "lung"];

async function bigBank() {
  const repo = new MemoryRepo();
  for (let i = 0; i < N; i += 1000) {
    await repo.create(
      Array.from({ length: Math.min(1000, N - i) }, (_, k) => ({
        ...blankQuestion("sba"),
        stem: `${WORDS[(i + k) % 8]} question number ${i + k} about physiology`,
        explanation: "Because of the mechanism described in the text.",
        answer: {
          options: [0, 1, 2, 3, 4].map((o) => ({ text: `Option ${o}`, correct: o === 1 })),
        },
        path: [`Subject ${(i + k) % 12}`, `Topic ${(i + k) % 40}`],
        tags: [`t${(i + k) % 30}`],
      })),
    );
  }
  return repo;
}

const timed = async <T>(f: () => Promise<T>) => {
  const t = performance.now();
  const value = await f();
  return { value, ms: performance.now() - t };
};

describe(`a bank of ${N} questions`, () => {
  it("lists, searches and copies to the device without dropping any", async () => {
    const repo = await bigBank();

    const page = await timed(() => repo.list({ ...DEFAULT_QUERY, limit: 30 }));
    expect(page.value.total).toBe(N);
    expect(page.value.items).toHaveLength(30);
    expect(page.ms).toBeLessThan(1000);

    const found = await timed(() =>
      repo.list({ ...DEFAULT_QUERY, search: "heart phys", limit: 30 }),
    );
    expect(found.value.total).toBe(Math.ceil(N / 8));
    expect(found.ms).toBeLessThan(1500);

    const copy = await timed(() => buildPack(repo));
    expect(copy.value.questions).toHaveLength(N);
    expect(copy.ms).toBeLessThan(10_000);

    const offline = new PackRepo(copy.value);
    const again = await timed(() => offline.list({ ...DEFAULT_QUERY, search: "heart", limit: 30 }));
    expect(again.value.total).toBe(Math.ceil(N / 8));
    expect(again.ms).toBeLessThan(1500);
  }, 60_000);

  it("backs up every question", async () => {
    const repo = await bigBank();
    const made = await timed(() => buildBackup(repo, new MemoryWorkspace()));
    expect(made.value.questions).toHaveLength(N);
    expect(made.value.manifest?.counts.questions).toBe(N);
    expect(made.ms).toBeLessThan(20_000);
  }, 60_000);
});
