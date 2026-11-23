import { describe, expect, it } from "vitest";
import { MemoryRepo } from "../../modules/question-bank/data/memoryRepo.ts";
import { MemoryWorkspace } from "../../modules/workspace/data/memoryWorkspace.ts";
import { blankQuestion, type QuestionInput } from "../../modules/question-bank/domain/model.ts";
import { DEFAULT_QUERY } from "../../modules/question-bank/data/repo.ts";
import { MemoryAttempts } from "../../modules/practice/data/memoryAttempts.ts";
import {
  buildBackup,
  checkIntegrity,
  parseBackup,
  previewRestore,
  restoreBackup,
} from "./backupData.ts";

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
    ...(await import("../../modules/question-bank/data/repo.ts")).DEFAULT_QUERY,
    limit: 10,
  });
  const id = page.items.find((q) => q.stem === "First?")!.id;
  await ws.setBookmark(id, true);
  await ws.saveNote({ id: null, questionId: id, title: "T", body: "Remember this" });
  await ws.saveNote({ id: null, questionId: null, title: "Free", body: "Loose note" });
  await ws.saveFlashcard({ id: null, front: "Front", back: "Back" });
  await ws.saveTerm({ id: null, term: "Ischaemia", definition: "Low blood flow" });
  await ws.setExamTarget({ title: "Final", date: "2031-05-01", subjectIds: [] });
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
    await ws2.setExamTarget({ title: "Mine", date: "2030-01-01", subjectIds: [] });
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

  it("keeps practice history, saved exams and revision state through a restore", async () => {
    const { bank, ws } = await filled();
    const attempts = new MemoryAttempts("a");
    const { DEFAULT_QUERY } = await import("../../modules/question-bank/data/repo.ts");
    const items = (await bank.list({ ...DEFAULT_QUERY, limit: 10 })).items;
    const subject = (await bank.taxonomy()).length;
    void subject;
    await attempts.saveExam(null, {
      title: "Mock 1",
      instructions: "",
      timeLimitSec: 600,
      marksCorrect: 1,
      marksWrong: 0.25,
      randomize: false,
      rules: [{ nodeId: null, count: 2 }],
    });
    const exam = (await attempts.exams())[0]!;
    const id = await attempts.create({
      kind: "exam",
      examId: exam.id,
      title: "Mock 1",
      instantFeedback: false,
      timeLimitSec: 600,
      marksCorrect: 1,
      marksWrong: 0.25,
      startedAt: "2026-11-10T08:00:00.000Z",
      items: items.map((q) => ({
        questionId: q.id,
        snapshot: {
          qtype: q.qtype,
          stem: q.stem,
          explanation: q.explanation ?? "",
          answer: q.answer,
          difficulty: q.difficulty,
          path: q.path,
        },
      })),
    });
    await attempts.patchItem(id, 0, {
      response: { choices: [1] },
      flagged: true,
      confidence: "sure",
    });
    await attempts.submit(
      id,
      [
        { position: 0, verdict: "wrong", credit: 0, marks: -0.25, seconds: 42 },
        { position: 1, verdict: "unanswered", credit: 0, marks: 0, seconds: 7 },
      ],
      {
        score: -0.25,
        correct: 0,
        partial: 0,
        wrong: 1,
        unanswered: 1,
        secondsSpent: 49,
        submittedAt: "2026-11-10T08:05:00.000Z",
      },
    );
    await attempts.patchItem(id, 0, { mistakeReason: "careless" });
    await ws.addCards([items[0]!.id]);

    const backup = await buildBackup(bank, ws, attempts);
    expect(backup.version).toBe(3);
    expect(backup.attempts).toHaveLength(1);
    expect(backup.exams).toHaveLength(1);
    expect(backup.cards).toHaveLength(1);
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.attempts[0]!.items[0]!.seconds).toBe(42);

    const bank2 = new MemoryRepo();
    const ws2 = new MemoryWorkspace();
    const attempts2 = new MemoryAttempts("b");
    const r = await restoreBackup(parsed.backup, bank2, ws2, attempts2);
    expect(r).toMatchObject({ attempts: 1, exams: 1, cards: 1 });
    const [head] = await attempts2.list(10);
    const back = (await attempts2.get(head!.id))!;
    expect(back.status).toBe("submitted");
    expect(back.title).toBe("Mock 1");
    expect(back.submittedAt).toBe("2026-11-10T08:05:00.000Z");
    expect(back.score).toBe(-0.25);
    expect(back.secondsSpent).toBe(49);
    expect(back.items[0]).toMatchObject({
      response: { choices: [1] },
      flagged: true,
      seconds: 42,
      mistakeReason: "careless",
      confidence: "sure",
      verdict: "wrong",
    });
    expect(back.examId).toBe((await attempts2.exams())[0]!.id);
    expect((await ws2.cards()).length).toBe(1);

    // A second restore adds nothing.
    const again = await restoreBackup(parsed.backup, bank2, ws2, attempts2);
    expect(again).toMatchObject({ attempts: 0, exams: 0, cards: 0 });
  });

  it("still reads a version 1 file and drops unusable history", async () => {
    const v1 = {
      format: "learivo-backup",
      version: 1,
      createdAt: "",
      questions: [],
      notes: [],
      bookmarks: [],
      flashcards: [],
      glossary: [],
      examTarget: { title: "", date: null },
      dailyGoal: 20,
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.ok && parsed.backup.attempts).toEqual([]);
    const junk = parseBackup(
      JSON.stringify({
        ...v1,
        version: 2,
        attempts: [{ title: "x" }, 5, { items: [] }],
        exams: [{}],
        cards: [{}],
      }),
    );
    expect(junk.ok && [junk.backup.attempts, junk.backup.exams, junk.backup.cards]).toEqual([
      [],
      [],
      [],
    ]);
  });

  it("writes a manifest, and a changed or cut-short file fails its check", async () => {
    const { bank, ws } = await filled();
    const text = JSON.stringify(await buildBackup(bank, ws), null, 2);
    expect(await checkIntegrity(text)).toMatchObject({ kind: "ok", counts: { questions: 2 } });

    const edited = text.replace("Remember this", "Remember thus");
    expect(await checkIntegrity(edited)).toMatchObject({ kind: "damaged" });

    const cut = JSON.parse(text) as { questions: unknown[] };
    cut.questions.pop();
    const res = await checkIntegrity(JSON.stringify(cut));
    expect(res).toMatchObject({ kind: "damaged" });
    expect((res as { reason: string }).reason).toMatch(/cut short/);

    const noManifest = JSON.parse(text) as Record<string, unknown>;
    delete noManifest.manifest;
    expect(await checkIntegrity(JSON.stringify(noManifest))).toMatchObject({ kind: "damaged" });
    expect(await checkIntegrity('{"format":"learivo-backup","version":2}')).toEqual({
      kind: "none",
    });
  });

  it("carries collections and the Home layout, and restoring twice adds nothing", async () => {
    const { bank, ws } = await filled();
    const col = await bank.addCollection("Finals");
    const first = (await bank.list({ ...DEFAULT_QUERY, limit: 10 })).items[0]!;
    await bank.bulk([first.id], { kind: "collection", collectionId: col.id, add: true });
    await ws.setHomeLayout({
      order: ["recent", "focus", "numbers", "features", "goal", "week", "weak", "exam"],
      hidden: ["exam"],
    });
    const parsed = parseBackup(JSON.stringify(await buildBackup(bank, ws)));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.collections).toEqual([{ name: "Finals", hashes: expect.any(Array) }]);

    const bank2 = new MemoryRepo();
    const ws2 = new MemoryWorkspace();
    const r = await restoreBackup(parsed.backup, bank2, ws2);
    expect(r.collections).toBe(1);
    const got = (await bank2.collections())[0]!;
    expect(got).toMatchObject({ name: "Finals", count: 1 });
    expect((await ws2.homeLayout()).hidden).toEqual(["exam"]);
    const again = await restoreBackup(parsed.backup, bank2, ws2);
    expect(again).toMatchObject({ questions: 0, collections: 0, notes: 0, flashcards: 0 });
    expect((await bank2.collections())[0]!.count).toBe(1);
  });

  it("backs up a history longer than one page and restores all of it", async () => {
    const bank = new MemoryRepo();
    const ws = new MemoryWorkspace();
    await bank.create([question("Only one?")]);
    const q = (await bank.list({ ...DEFAULT_QUERY, limit: 5 })).items[0]!;
    const attempts = new MemoryAttempts("a");
    const N = 520;
    for (let i = 0; i < N; i++) {
      const id = await attempts.create({
        kind: "practice",
        examId: null,
        title: `S${i}`,
        instantFeedback: true,
        timeLimitSec: null,
        marksCorrect: 1,
        marksWrong: 0,
        startedAt: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(),
        items: [
          {
            questionId: q.id,
            snapshot: {
              qtype: q.qtype,
              stem: q.stem,
              explanation: "",
              answer: q.answer,
              difficulty: null,
              path: [],
            },
          },
        ],
      });
      await attempts.submit(
        id,
        [{ position: 0, verdict: "correct", credit: 1, marks: 1, seconds: 3 }],
        {
          score: 1,
          correct: 1,
          partial: 0,
          wrong: 0,
          unanswered: 0,
          secondsSpent: 3,
          submittedAt: new Date(Date.UTC(2026, 0, 1) + i * 60000 + 3000).toISOString(),
        },
      );
    }
    const backup = await buildBackup(bank, ws, attempts);
    expect(backup.attempts).toHaveLength(N);
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    const attempts2 = new MemoryAttempts("b");
    const r = await restoreBackup(
      parsed.backup,
      new MemoryRepo(),
      new MemoryWorkspace(),
      attempts2,
    );
    expect(r.attempts).toBe(N);
    expect(
      (await restoreBackup(parsed.backup, new MemoryRepo(), new MemoryWorkspace(), attempts2))
        .attempts,
    ).toBe(0);
  });
});
