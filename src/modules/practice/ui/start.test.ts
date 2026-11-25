import { describe, expect, it } from "vitest";
import { nodeIdForName, startPractice, startSmart } from "./start.ts";
import { MemoryRepo } from "../../question-bank/data/memoryRepo.ts";
import { MemoryAttempts } from "../data/memoryAttempts.ts";
import { MemoryWorkspace } from "../../workspace/data/memoryWorkspace.ts";
import { blankQuestion } from "../../question-bank/domain/model.ts";
import { TF_ANSWER } from "../../../testing/fixtures.ts";
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

describe("exam subjects lean the mix", () => {
  const q = (stem: string, path: string[]) => ({
    ...blankQuestion("true_false"),
    stem,
    explanation: "x",
    answer: TF_ANSWER,
    path,
  });
  const day = (n: number) => {
    const d = new Date(Date.now() + n * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  async function world(date: string | null) {
    const bank = new MemoryRepo();
    const attempts = new MemoryAttempts();
    const ws = new MemoryWorkspace();
    await bank.create([
      ...Array.from({ length: 20 }, (_, i) => q(`A${i}`, ["Anatomy"])),
      ...Array.from({ length: 60 }, (_, i) => q(`P${i}`, ["Physiology"])),
    ]);
    const anatomy = (await bank.taxonomy()).find((n) => n.name === "Anatomy")!;
    if (date) await ws.setExamTarget({ title: "Final", date, subjectIds: [anatomy.id] });
    return { bank, attempts, ws };
  }
  const stems = async (attempts: MemoryAttempts, id: string) =>
    (await attempts.get(id))!.items.map((i) => i.snapshot.stem);
  const setup = {
    nodeId: null,
    tagId: null,
    collectionId: null,
    filter: "all" as const,
    count: 20,
    minutes: null,
    instantFeedback: true,
    shuffleOptions: false,
  };

  it("practice with no subject chosen takes about half from the exam subjects", async () => {
    const { bank, attempts, ws } = await world(day(10));
    const id = await startPractice(bank, attempts, setup, ws);
    const got = await stems(attempts, id);
    expect(got).toHaveLength(20);
    expect(got.filter((x) => x.startsWith("A"))).toHaveLength(10);
    expect(got.filter((x) => x.startsWith("P"))).toHaveLength(10);
  });

  it("a subject the student picks is never overridden", async () => {
    const { bank, attempts, ws } = await world(day(10));
    const phys = (await bank.taxonomy()).find((n) => n.name === "Physiology")!;
    const id = await startPractice(bank, attempts, { ...setup, nodeId: phys.id }, ws);
    expect((await stems(attempts, id)).every((x) => x.startsWith("P"))).toBe(true);
  });

  it("changes nothing once the exam is past or when no subjects are chosen", async () => {
    for (const date of [day(-3), null]) {
      const { bank, attempts, ws } = await world(date);
      let anatomy = 0;
      for (let i = 0; i < 12; i++) {
        const got = await stems(attempts, await startPractice(bank, attempts, setup, ws));
        anatomy += got.filter((x) => x.startsWith("A")).length;
      }
      // Fair mix: Anatomy is a quarter of the bank (about 60 of 240), far from the 120 a focus gives.
      expect(anatomy).toBeGreaterThan(30);
      expect(anatomy).toBeLessThan(90);
    }
  });

  it("Smart mix leans to the exam subjects too", async () => {
    const { bank, attempts, ws } = await world(day(10));
    const id = await startSmart(bank, attempts, ws);
    const got = await stems(attempts, id);
    expect(got).toHaveLength(20);
    expect(got.filter((x) => x.startsWith("A"))).toHaveLength(10);
  });
});

describe("practice from skipped questions", () => {
  const q = (stem: string) => ({
    ...blankQuestion("true_false"),
    stem,
    explanation: "x",
    answer: TF_ANSWER,
    path: ["Anatomy"],
  });
  const setup = {
    nodeId: null,
    tagId: null,
    collectionId: null,
    filter: "skipped" as const,
    count: 20,
    minutes: null,
    instantFeedback: true,
    shuffleOptions: true,
  };
  /** A finished session in which each question is either answered (right) or left unanswered. */
  async function session(attempts: MemoryAttempts, items: { id: string; skipped: boolean }[]) {
    const id = await attempts.create({
      kind: "practice",
      examId: null,
      title: "s",
      instantFeedback: false,
      timeLimitSec: null,
      marksCorrect: 1,
      marksWrong: 0,
      items: items.map((x) => ({
        questionId: x.id,
        snapshot: {
          qtype: "true_false",
          stem: x.id,
          explanation: "",
          answer: TF_ANSWER,
          difficulty: null,
          path: [],
        },
      })),
    });
    await attempts.submit(
      id,
      items.map((x, position) => ({
        position,
        verdict: x.skipped ? "unanswered" : "correct",
        credit: x.skipped ? 0 : 1,
        marks: x.skipped ? 0 : 1,
      })),
      { score: 0, correct: 0, partial: 0, wrong: 0, unanswered: 0, secondsSpent: 1 },
    );
  }

  it("draws only the questions whose latest appearance was skipped", async () => {
    const bank = new MemoryRepo();
    const attempts = new MemoryAttempts();
    const [a, b, c] = await bank.create([q("A"), q("B"), q("C")]);
    await session(attempts, [
      { id: a!, skipped: true },
      { id: b!, skipped: true },
      { id: c!, skipped: false },
    ]);
    // B is answered in a later session, so it is no longer skipped.
    await session(attempts, [{ id: b!, skipped: false }]);
    expect(await attempts.skipped()).toEqual(new Set([a!]));
    const id = await startPractice(bank, attempts, setup);
    expect((await attempts.get(id))!.items.map((i) => i.snapshot.stem)).toEqual(["A"]);
  });

  it("says so when nothing was skipped", async () => {
    const bank = new MemoryRepo();
    await bank.create([q("A")]);
    await expect(startPractice(bank, new MemoryAttempts(), setup)).rejects.toThrow();
  });
});
