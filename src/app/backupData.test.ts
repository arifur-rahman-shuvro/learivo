import { describe, expect, it } from "vitest";
import { MemoryRepo } from "../modules/question-bank/data/memoryRepo.ts";
import { MemoryWorkspace } from "../modules/workspace/data/memoryWorkspace.ts";
import { blankQuestion, type QuestionInput } from "../modules/question-bank/domain/model.ts";
import { buildBackup, parseBackup, previewRestore, restoreBackup } from "./backupData.ts";

function question(stem: string): QuestionInput {
  return {
    ...blankQuestion("sba"),
    stem,
    answer: {
      options: [
        { text: "A", correct: true },
        { text: "B", correct: false },
      ],
    },
  };
}

async function filled() {
  const bank = new MemoryRepo();
  const ws = new MemoryWorkspace();
  await bank.create([question("First?"), question("Second?")]);
  const first = (await bank.exportAll()).length;
  expect(first).toBe(2);
  const page = await bank.list({
    ...(await import("../modules/question-bank/data/repo.ts")).DEFAULT_QUERY,
    limit: 10,
  });
  const id = page.items.find((q) => q.stem === "First?")!.id;
  await ws.setBookmark(id, true);
  await ws.saveNote({ id: null, questionId: id, title: "T", body: "Remember this" });
  await ws.saveNote({ id: null, questionId: null, title: "Free", body: "Loose note" });
  await ws.saveFlashcard({ id: null, front: "Front", back: "Back" });
  await ws.saveTerm({ id: null, term: "Ischaemia", definition: "Low blood flow" });
  await ws.setExamTarget({ title: "Final", date: "2031-05-01" });
  await ws.setDailyGoal(35);
  return { bank, ws };
}

describe("backup", () => {
  it("round-trips everything into an empty account", async () => {
    const { bank, ws } = await filled();
    const backup = await buildBackup(bank, ws);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const bank2 = new MemoryRepo();
    const ws2 = new MemoryWorkspace();
    const pre = await previewRestore(parsed.backup, bank2);
    expect(pre).toEqual({ newQuestions: 2, existing: 0, invalid: 0 });
    const r = await restoreBackup(parsed.backup, bank2, ws2);
    expect(r).toMatchObject({
      questions: 2,
      notes: 2,
      bookmarks: 1,
      flashcards: 1,
      glossary: 1,
      settings: 2,
    });
    expect(r.failure).toBeUndefined();
    expect((await ws2.notes()).map((n) => n.body).sort()).toEqual(["Loose note", "Remember this"]);
    expect((await ws2.examTarget()).date).toBe("2031-05-01");
    expect(await ws2.dailyGoal()).toBe(35);
    const note = (await ws2.notes()).find((n) => n.body === "Remember this")!;
    expect(note.questionId).not.toBeNull();
  });

  it("restoring twice adds nothing the second time", async () => {
    const { bank, ws } = await filled();
    const backup = await buildBackup(bank, ws);
    const bank2 = new MemoryRepo();
    const ws2 = new MemoryWorkspace();
    await restoreBackup(backup, bank2, ws2);
    const again = await restoreBackup(backup, bank2, ws2);
    expect(again).toMatchObject({
      questions: 0,
      questionsSkipped: 2,
      notes: 0,
      bookmarks: 0,
      flashcards: 0,
      glossary: 0,
      settings: 0,
    });
  });

  it("never overwrites an exam target that is already set", async () => {
    const { bank, ws } = await filled();
    const backup = await buildBackup(bank, ws);
    const ws2 = new MemoryWorkspace();
    await ws2.setExamTarget({ title: "Mine", date: "2030-01-01" });
    await restoreBackup(backup, new MemoryRepo(), ws2);
    expect((await ws2.examTarget()).title).toBe("Mine");
  });

  it("refuses files that are not backups and drops unusable entries", () => {
    expect(parseBackup("nope").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: "other" })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: "learivo-backup", version: 9 })).ok).toBe(false);
    const p = parseBackup(
      JSON.stringify({
        format: "learivo-backup",
        version: 1,
        flashcards: [{ front: "", back: "x" }, { front: "a", back: "b" }, 5],
        glossary: [{ term: "t" }],
        dailyGoal: 9999,
      }),
    );
    expect(p.ok && p.backup.flashcards).toEqual([{ front: "a", back: "b" }]);
    expect(p.ok && p.backup.glossary).toEqual([]);
    expect(p.ok && p.backup.dailyGoal).toBe(20);
  });
});
