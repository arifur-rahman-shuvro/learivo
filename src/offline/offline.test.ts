import { describe, expect, it } from "vitest";
import { MemoryRepo } from "../modules/question-bank/data/memoryRepo.ts";
import { DEFAULT_QUERY } from "../modules/question-bank/data/repo.ts";
import { blankQuestion, type QuestionInput } from "../modules/question-bank/domain/model.ts";
import { MemoryAttempts } from "../modules/practice/data/memoryAttempts.ts";
import type { NewAttempt } from "../modules/practice/data/repo.ts";
import { OFFLINE_MESSAGE, OfflineAwareRepo, PackRepo, buildPack } from "./pack.ts";
import { MemoryStore } from "./store.ts";
import { SyncedAttempts } from "./syncedAttempts.ts";

const tf = (stem: string, path: string[] = [], tags: string[] = []): QuestionInput => ({
  ...blankQuestion("true_false"),
  stem,
  explanation: `Because ${stem}`,
  answer: { answer: true },
  path,
  tags,
});

async function seededBank() {
  const bank = new MemoryRepo();
  await bank.create([
    tf("Heart pumps blood", ["Anatomy", "Heart"], ["core"]),
    tf("Femur is a bone", ["Anatomy", "Bones"]),
    tf("Loose question"),
  ]);
  return bank;
}

describe("offline pack", () => {
  it("copies every active question with its subjects and tags", async () => {
    const pack = await buildPack(await seededBank());
    expect(pack.questions).toHaveLength(3);
    expect(pack.taxonomy.map((n) => n.name).sort()).toEqual(["Anatomy", "Bones", "Heart"]);
    expect(pack.tags.map((t) => t.name)).toEqual(["core"]);
  });

  it("answers searches and filters from the pack the same way as the live bank", async () => {
    const bank = await seededBank();
    const pack = new PackRepo(await buildPack(bank));
    const node = (await bank.taxonomy()).find((n) => n.name === "Anatomy")!;
    for (const q of [
      { ...DEFAULT_QUERY },
      { ...DEFAULT_QUERY, search: "heart" },
      { ...DEFAULT_QUERY, nodeId: node.id },
      { ...DEFAULT_QUERY, unclassified: true },
      { ...DEFAULT_QUERY, sort: "stem" as const },
    ]) {
      const live = await bank.list(q);
      const copy = await pack.list(q);
      expect(copy.total).toBe(live.total);
      expect(copy.items.map((x) => x.id)).toEqual(live.items.map((x) => x.id));
    }
    expect((await pack.list({ ...DEFAULT_QUERY, status: "archived" })).total).toBe(0);
  });

  it("refuses every change", async () => {
    const pack = new PackRepo(await buildPack(await seededBank()));
    await expect(pack.create()).rejects.toThrow(OFFLINE_MESSAGE);
    await expect(pack.addTag()).rejects.toThrow(OFFLINE_MESSAGE);
  });

  it("uses the live bank online and the pack offline, and refuses edits offline", async () => {
    const bank = await seededBank();
    let online = true;
    const repo = new OfflineAwareRepo(bank, new MemoryStore(), "u1", () => online);
    expect((await repo.status()).savedAt).toBeNull();
    const status = await repo.download();
    expect(status.count).toBe(3);

    await bank.create([tf("Added after download")]);
    expect((await repo.list(DEFAULT_QUERY)).total).toBe(4);

    online = false;
    expect((await repo.list(DEFAULT_QUERY)).total).toBe(3);
    await expect(repo.create([tf("Nope")])).rejects.toThrow(OFFLINE_MESSAGE);
  });

  it("falls back to the pack when the connection claims to be up but fails", async () => {
    const bank = await seededBank();
    const repo = new OfflineAwareRepo(bank, new MemoryStore(), "u1", () => true);
    await repo.download();
    bank.list = async () => {
      throw new Error("Failed to fetch");
    };
    expect((await repo.list(DEFAULT_QUERY)).total).toBe(3);
  });

  it("without a pack, a failed read is an error", async () => {
    const bank = await seededBank();
    bank.list = async () => {
      throw new Error("Failed to fetch");
    };
    const repo = new OfflineAwareRepo(bank, new MemoryStore(), "u1", () => false);
    await expect(repo.list(DEFAULT_QUERY)).rejects.toThrow("Failed to fetch");
  });

  it("keeps the pack between visits, per user, and clears it on request", async () => {
    const bank = await seededBank();
    const store = new MemoryStore();
    await new OfflineAwareRepo(bank, store, "u1", () => true).download();
    const again = new OfflineAwareRepo(bank, store, "u1", () => false);
    expect((await again.status()).count).toBe(3);
    expect((await new OfflineAwareRepo(bank, store, "u2", () => false).status()).count).toBe(0);
    await again.remove();
    expect((await again.status()).enabled).toBe(false);
    expect((await again.status()).count).toBe(0);
  });

  it("only refreshes when the student keeps a copy and is online", async () => {
    const bank = await seededBank();
    const repo = new OfflineAwareRepo(bank, new MemoryStore(), "u1", () => true);
    await repo.remove();
    await repo.refresh();
    expect((await repo.status()).count).toBe(0);
    await repo.download();
    await bank.create([tf("New")]);
    await repo.refresh();
    expect((await repo.status()).count).toBe(4);
  });
});

const session = (): NewAttempt => ({
  kind: "practice",
  examId: null,
  title: "Quick practice",
  instantFeedback: true,
  timeLimitSec: null,
  marksCorrect: 1,
  marksWrong: 0,
  items: [
    {
      questionId: "q1",
      snapshot: {
        qtype: "true_false",
        stem: "Heart pumps blood",
        explanation: "",
        answer: { answer: true },
        difficulty: null,
        path: ["Anatomy"],
      },
    },
  ],
});

async function finish(repo: SyncedAttempts) {
  const id = await repo.create(session());
  await repo.patchItem(id, 0, { response: { kind: "true_false", value: true } as never });
  await repo.submit(id, [{ position: 0, verdict: "correct", marks: 1 }], {
    score: 1,
    correct: 1,
    wrong: 0,
    unanswered: 0,
    secondsSpent: 12,
  });
  return id;
}

describe("offline sessions", () => {
  it("keeps a finished session on the device offline and sends it once, later", async () => {
    const remote = new MemoryAttempts();
    let online = false;
    const repo = new SyncedAttempts(remote, new MemoryStore(), "u1", () => online);

    const id = await finish(repo);
    expect(repo.getState().waiting).toBe(1);
    expect(await remote.list(10)).toHaveLength(0);
    expect((await repo.list(10)).map((a) => a.status)).toEqual(["submitted"]);
    expect((await repo.facts(10)).length).toBe(1);
    expect((await repo.get(id))?.score).toBe(1);

    online = true;
    await repo.sync();
    const sent = await remote.list(10);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ status: "submitted", score: 1, secondsSpent: 12 });
    expect(repo.getState()).toMatchObject({ waiting: 0, syncing: false, problem: null });

    // The same session, found by its old id, and not listed twice.
    expect((await repo.get(id))?.score).toBe(1);
    expect(await repo.list(10)).toHaveLength(1);
    expect((await repo.facts(10)).length).toBe(1);
    await repo.sync();
    expect(await remote.list(10)).toHaveLength(1);
  });

  it("keeps the original start and finish times when it is sent late", async () => {
    const remote = new MemoryAttempts();
    let online = false;
    const repo = new SyncedAttempts(remote, new MemoryStore(), "u1", () => online);
    await finish(repo);
    const [local] = await repo.list(10);
    online = true;
    await repo.sync();
    const [sent] = await remote.list(10);
    expect(sent!.startedAt).toBe(local!.startedAt);
    expect(sent!.submittedAt).toBe(local!.submittedAt);
  });

  it("sends straight away when online", async () => {
    const remote = new MemoryAttempts();
    const repo = new SyncedAttempts(remote, new MemoryStore(), "u1", () => true);
    await finish(repo);
    expect(await remote.list(10)).toHaveLength(1);
    expect(repo.getState().waiting).toBe(0);
  });

  it("survives a failed send without creating the session twice", async () => {
    const remote = new MemoryAttempts();
    const repo = new SyncedAttempts(remote, new MemoryStore(), "u1", () => true);
    const real = remote.submit.bind(remote);
    let fail = true;
    remote.submit = async (...args) => {
      if (fail) throw new Error("Network lost");
      return real(...args);
    };
    await finish(repo);
    expect(repo.getState()).toMatchObject({ waiting: 1, problem: "Network lost" });
    expect(await remote.list(10)).toHaveLength(1);

    fail = false;
    await repo.sync();
    const all = await remote.list(10);
    expect(all).toHaveLength(1);
    expect(all[0]!.status).toBe("submitted");
    expect(repo.getState()).toMatchObject({ waiting: 0, problem: null });
  });

  it("is still there after the app is closed and opened again", async () => {
    const remote = new MemoryAttempts();
    const store = new MemoryStore();
    let online = false;
    await finish(new SyncedAttempts(remote, store, "u1", () => online));

    const reopened = new SyncedAttempts(remote, store, "u1", () => online);
    expect((await reopened.list(10)).length).toBe(1);
    online = true;
    await reopened.sync();
    expect(await remote.list(10)).toHaveLength(1);
    expect(reopened.getState().waiting).toBe(0);
  });

  it("keeps sessions of different users apart", async () => {
    const store = new MemoryStore();
    await finish(new SyncedAttempts(new MemoryAttempts(), store, "u1", () => false));
    const other = new SyncedAttempts(new MemoryAttempts(), store, "u2", () => false);
    expect(await other.list(10)).toHaveLength(0);
  });

  it("counts waiting sessions as the latest answers", async () => {
    const repo = new SyncedAttempts(new MemoryAttempts(), new MemoryStore(), "u1", () => false);
    await finish(repo);
    expect((await repo.past()).get("q1")).toEqual({ last: "correct", times: 1 });
  });

  it("serves exams from the device when the connection is gone", async () => {
    const remote = new MemoryAttempts();
    await remote.saveExam(null, {
      title: "Mock 1",
      instructions: "",
      timeLimitSec: null,
      marksCorrect: 1,
      marksWrong: 0,
      randomize: false,
      rules: [],
    });
    const store = new MemoryStore();
    const repo = new SyncedAttempts(remote, store, "u1", () => true);
    expect((await repo.exams()).map((e) => e.title)).toEqual(["Mock 1"]);

    remote.exams = async () => {
      throw new Error("Failed to fetch");
    };
    const reopened = new SyncedAttempts(remote, store, "u1", () => false);
    expect((await reopened.exams()).map((e) => e.title)).toEqual(["Mock 1"]);
  });

  it("discarding an unsent session removes it from the waiting count", async () => {
    const repo = new SyncedAttempts(new MemoryAttempts(), new MemoryStore(), "u1", () => false);
    const id = await finish(repo);
    await repo.remove(id);
    expect(repo.getState().waiting).toBe(0);
    expect(await repo.list(10)).toHaveLength(0);
  });
});
