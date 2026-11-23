import { describe, expect, it } from "vitest";
import { MemoryRepo } from "../../question-bank/data/memoryRepo.ts";
import { blankQuestion } from "../../question-bank/domain/model.ts";
import { TF_ANSWER } from "../../../testing/fixtures.ts";
import { examScope } from "./examScope.ts";

const tf = (stem: string, path: string[]) => ({
  ...blankQuestion("true_false"),
  stem,
  explanation: "x",
  answer: TF_ANSWER,
  path,
});

describe("examScope", () => {
  it("counts the whole bank when no subject is chosen", async () => {
    const bank = new MemoryRepo();
    const ids = await bank.create([tf("A", ["Anatomy"]), tf("P", ["Physiology"])]);
    expect(await examScope(bank, [], new Set([ids[0]!, "elsewhere"]))).toEqual({
      total: 2,
      seen: 2,
    });
  });

  it("counts only the chosen subjects, including more than one page of questions", async () => {
    const bank = new MemoryRepo();
    const ids = await bank.create([
      ...Array.from({ length: 520 }, (_, i) => tf(`A${i}`, ["Anatomy"])),
      tf("P", ["Physiology"]),
    ]);
    const anatomy = (await bank.taxonomy()).find((n) => n.name === "Anatomy")!;
    const practised = new Set([ids[0]!, ids[519]!, ids[520]!]);
    expect(await examScope(bank, [anatomy.id], practised)).toEqual({ total: 520, seen: 2 });
  });
});
