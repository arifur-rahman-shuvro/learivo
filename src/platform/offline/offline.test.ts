import { describe, expect, it, vi } from "vitest";
import { reportError } from "../../core/monitoring.ts";
import { MemoryRepo } from "../../modules/question-bank/data/memoryRepo.ts";
import { DEFAULT_QUERY } from "../../modules/question-bank/data/repo.ts";
import { blankQuestion, type QuestionInput } from "../../modules/question-bank/domain/model.ts";
import { MemoryAttempts } from "../../modules/practice/data/memoryAttempts.ts";
import type { NewAttempt } from "../../modules/practice/data/repo.ts";
import {
  NO_COPY_MESSAGE,
  OFFLINE_MESSAGE,
  OfflineAwareRepo,
  PackRepo,
  UnsentChangesError,
  buildPack,
} from "./pack.ts";
import { MemoryStore } from "./store.ts";
import { inputOf } from "./merge.ts";
import { analyzeImport } from "../../modules/question-bank/domain/importExport.ts";
import { SyncedAttempts } from "./syncedAttempts.ts";
import { TF_ANSWER } from "../../testing/fixtures.ts";

vi.mock("../../core/monitoring.ts", () => ({ reportError: vi.fn() }));

const tf = (stem: string, path: string[] = [], tags: string[] = []): QuestionInput => ({
  ...blankQuestion("true_false"),
  stem,
  explanation: `Because ${stem}`,
  answer: TF_ANSWER,
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

  it("uses the live bank online and the pack offline, and refuses structure changes offline", async () => {
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
    await expect(repo.addTag("nope")).rejects.toThrow(OFFLINE_MESSAGE);
  });

  it("without a copy on the device, an offline add is refused with a clear reason", async () => {
    const repo = new OfflineAwareRepo(new MemoryRepo(), new MemoryStore(), "u1", () => false);
    await expect(repo.create([tf("Nope")])).rejects.toThrow(NO_COPY_MESSAGE);
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
        answer: TF_ANSWER,
        difficulty: null,
        path: ["Anatomy"],
      },
    },
  ],
});

async function finish(repo: SyncedAttempts) {
  const id = await repo.create(session());
  await repo.patchItem(id, 0, { response: { marks: [true, false, true, false, false] } });
  await repo.submit(id, [{ position: 0, verdict: "correct", credit: 1, marks: 1 }], {
    score: 1,
    correct: 1,
    partial: 0,
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

describe("offline edits", () => {
  async function setup() {
    const bank = await seededBank();
    const store = new MemoryStore();
    const net = { online: true };
    const make = () => new OfflineAwareRepo(bank, store, "u1", () => net.online);
    const repo = make();
    await repo.download();
    return { bank, store, net, repo, make };
  }
  const stems = async (r: { list: OfflineAwareRepo["list"] }) =>
    (await r.list({ ...DEFAULT_QUERY, sort: "stem" })).items.map((i) => i.stem);

  it("adds a question offline, shows it at once, and sends it once back online", async () => {
    const { bank, net, repo } = await setup();
    net.online = false;
    const [id] = await repo.create([tf("Written on the train", ["Anatomy", "Heart"], ["core"])]);
    expect(await stems(repo)).toContain("Written on the train");
    const rec = await repo.get(id!);
    expect(rec?.nodeId).not.toBeNull();
    expect(rec?.tagIds).toHaveLength(1);
    expect((await repo.status()).waiting).toBe(1);
    expect(await bank.get(id!)).toBeNull();

    net.online = true;
    const report = await repo.flushEdits();
    expect(report.sent).toBe(1);
    expect((await bank.get(id!))?.stem).toBe("Written on the train"); // same id as on the device
    expect((await repo.status()).waiting).toBe(0);
  });

  it("does not add the same question twice when a send is repeated", async () => {
    const { bank, net, repo } = await setup();
    net.online = false;
    const [id] = await repo.create([tf("Once only")]);
    await bank.create([tf("Once only")], [id!]); // it already arrived, but the device never heard
    net.online = true;
    await repo.flushEdits();
    expect((await bank.exportAll()).filter((q) => q.stem === "Once only")).toHaveLength(1);
  });

  it("edits offline; several edits to one question count as one", async () => {
    const { bank, net, repo } = await setup();
    const rec = (await repo.list({ ...DEFAULT_QUERY, search: "heart" })).items[0]!;
    net.online = false;
    await repo.update(rec.id, { ...tf("Heart pumps blood, edit 1"), path: rec.path, tags: [] });
    await repo.update(rec.id, { ...tf("Heart pumps blood, edit 2"), path: rec.path, tags: [] });
    expect((await repo.get(rec.id))?.stem).toBe("Heart pumps blood, edit 2");
    expect((await repo.status()).waiting).toBe(1);
    net.online = true;
    const report = await repo.flushEdits();
    expect(report).toMatchObject({ sent: 1, conflicts: 0 });
    expect((await bank.get(rec.id))?.stem).toBe("Heart pumps blood, edit 2");
  });

  it("holds a clash for a decision instead of overwriting, and keeps both versions", async () => {
    const { bank, net, repo } = await setup();
    const rec = (await repo.list({ ...DEFAULT_QUERY, search: "femur" })).items[0]!;
    net.online = false;
    await repo.update(rec.id, { ...tf("Femur, my phone edit"), path: rec.path, tags: [] });
    await bank.update(rec.id, { ...tf("Femur, laptop edit"), path: rec.path, tags: [] });
    net.online = true;
    const report = await repo.flushEdits();
    expect(report).toMatchObject({ conflicts: 1, merged: 0 });
    expect((await bank.get(rec.id))?.stem).toBe("Femur, laptop edit"); // not overwritten
    const [c] = (await repo.status()).conflicts;
    expect(c).toMatchObject({ kind: "edited" });
    expect(c!.clashes).toContain("stem");
    expect(c!.mine.stem).toBe("Femur, my phone edit");
    expect(c!.theirs!.stem).toBe("Femur, laptop edit");
    expect(c!.base!.stem).toContain("emur");
  });

  it("combines edits to different parts of a question without asking", async () => {
    const { bank, net, repo } = await setup();
    const rec = (await repo.list({ ...DEFAULT_QUERY, search: "femur" })).items[0]!;
    const base = await bank.get(rec.id);
    net.online = false;
    await repo.update(rec.id, { ...inputOf(base!), explanation: "Written on my phone" });
    await bank.update(rec.id, { ...inputOf(base!), stem: "Femur, edited on the laptop" });
    net.online = true;
    const report = await repo.flushEdits();
    expect(report).toMatchObject({ merged: 1, conflicts: 0 });
    const now = await bank.get(rec.id);
    expect(now?.stem).toBe("Femur, edited on the laptop");
    expect(now?.explanation).toBe("Written on my phone");
  });

  it("applies the student's decision: mine, the account's, or field by field", async () => {
    const { bank, net, repo } = await setup();
    const rec = (await repo.list({ ...DEFAULT_QUERY, search: "femur" })).items[0]!;
    const base = inputOf((await bank.get(rec.id))!);
    const clash = async (mine: Partial<typeof base>, theirs: Partial<typeof base>) => {
      net.online = false;
      await repo.update(rec.id, { ...base, ...mine });
      await bank.update(rec.id, { ...base, ...theirs });
      net.online = true;
      await repo.flushEdits();
    };
    await clash(
      { stem: "Mine A", explanation: "Mine X" },
      { stem: "Cloud A", explanation: "Cloud X" },
    );
    await repo.resolveConflict(rec.id, { stem: "mine", explanation: "theirs" });
    let now = await bank.get(rec.id);
    expect([now?.stem, now?.explanation]).toEqual(["Mine A", "Cloud X"]);
    expect((await repo.status()).conflicts).toHaveLength(0);
    expect((await repo.status()).resolved[0]).toMatchObject({ outcome: "merged" });

    await clash({ stem: "Mine B" }, { stem: "Cloud B" });
    await repo.resolveConflict(rec.id, "theirs");
    now = await bank.get(rec.id);
    expect(now?.stem).toBe("Cloud B");

    await clash({ stem: "Mine C" }, { stem: "Cloud C" });
    await repo.resolveConflict(rec.id, "mine");
    expect((await bank.get(rec.id))?.stem).toBe("Mine C");

    // an earlier decision can be undone from the history list
    const idx = (await repo.status()).resolved.findIndex((r) => r.outcome === "theirs");
    await repo.reapply(idx, "mine");
    expect((await bank.get(rec.id))?.stem).toBe("Mine B");
  });

  it("asks what to do with an edit to a question deleted elsewhere", async () => {
    const { bank, net, repo } = await setup();
    const rec = (await repo.list({ ...DEFAULT_QUERY, search: "femur" })).items[0]!;
    net.online = false;
    await repo.update(rec.id, {
      ...inputOf((await bank.get(rec.id))!),
      stem: "Edited then deleted",
    });
    await bank.bulk([rec.id], { kind: "delete" });
    net.online = true;
    expect(await repo.flushEdits()).toMatchObject({ conflicts: 1 });
    expect((await repo.status()).conflicts[0]).toMatchObject({ kind: "deleted", theirs: null });
    await repo.resolveConflict(rec.id, "mine");
    expect((await bank.exportAll()).map((q) => q.stem)).toContain("Edited then deleted");
    expect((await repo.status()).resolved[0]).toMatchObject({ outcome: "re-added" });
  });

  it("does not sign out over an undecided clash without asking", async () => {
    const { bank, net, repo } = await setup();
    const rec = (await repo.list({ ...DEFAULT_QUERY, search: "femur" })).items[0]!;
    net.online = false;
    await repo.update(rec.id, { ...inputOf((await bank.get(rec.id))!), stem: "Mine" });
    await bank.update(rec.id, { ...inputOf((await bank.get(rec.id))!), stem: "Theirs" });
    net.online = true;
    await repo.flushEdits();
    const err = await repo.clear().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnsentChangesError);
    expect((err as UnsentChangesError).summaries[0]).toContain("Decision needed");
    expect(JSON.parse((await repo.exportPending())!).questions[0].stem).toBe("Mine");
  });

  it("archives and tags offline, and holds edits to questions deleted elsewhere", async () => {
    const { bank, net, repo } = await setup();
    const all = (await repo.list(DEFAULT_QUERY)).items;
    const [a, b] = [all[0]!, all[1]!];
    const tag = (await repo.tags())[0]!;
    net.online = false;
    await repo.bulk([a.id], { kind: "archive" });
    await repo.bulk([b.id], { kind: "tag", tagId: tag.id, add: true });
    await repo.update(all[2]!.id, { ...tf("Edit of a deleted one"), path: [], tags: [] });
    expect((await repo.list(DEFAULT_QUERY)).total).toBe(2);
    expect((await repo.get(b.id))?.tagIds).toContain(tag.id);
    await bank.bulk([all[2]!.id], { kind: "delete" });
    net.online = true;
    const report = await repo.flushEdits();
    expect(report).toMatchObject({ conflicts: 1 });
    expect((await bank.get(a.id))?.status).toBe("archived");
    expect((await bank.get(b.id))?.tagIds).toContain(tag.id);
  });

  it("survives closing the app: a new session picks the waiting changes up", async () => {
    const { bank, net, make, repo } = await setup();
    net.online = false;
    await repo.create([tf("Kept across restarts")]);
    const again = make();
    expect((await again.status()).waiting).toBe(1);
    expect(await stems(again)).toContain("Kept across restarts");
    net.online = true;
    await again.flushEdits();
    expect((await bank.exportAll()).map((q) => q.stem)).toContain("Kept across restarts");
  });

  it("does not replace the copy or remove it while changes wait", async () => {
    const { net, repo } = await setup();
    net.online = false;
    await repo.create([tf("Unsent")]);
    await repo.refresh(); // offline: does nothing
    expect(await stems(repo)).toContain("Unsent");
    await expect(repo.remove()).rejects.toThrow(/waiting to be sent/);
  });

  it("keeps a change when the connection says online but the request never arrives", async () => {
    const { bank, repo } = await setup();
    const real = bank.create.bind(bank);
    bank.create = async () => {
      throw new TypeError("Failed to fetch");
    };
    const [id] = await repo.create([tf("Flaky network")]);
    expect((await repo.status()).waiting).toBe(1);
    expect(await stems(repo)).toContain("Flaky network"); // read from the copy while it waits
    bank.create = real;
    await repo.flushEdits();
    expect((await bank.get(id!))?.stem).toBe("Flaky network");
  });

  it("reports a change the database refuses and carries on with the rest", async () => {
    const { bank, net, repo } = await setup();
    net.online = false;
    await repo.create([tf("Refused one")]);
    await repo.create([tf("Accepted one")]);
    net.online = true;
    const real = bank.create.bind(bank);
    bank.create = async (inputs, ids) => {
      if (inputs[0]!.stem === "Refused one") throw new Error("value too long");
      return real(inputs, ids);
    };
    const report = await repo.flushEdits();
    expect(report).toMatchObject({ sent: 1, failed: 1 });
    const status = await repo.status();
    expect(status.waiting).toBe(0);
    expect(status.failed[0]).toMatchObject({ message: "value too long" });
    expect(status.failed[0]!.summary).toContain("Refused one");
    // Monitoring hears about it, but only the kind of change: no text, no database message.
    const sent = vi.mocked(reportError).mock.calls.map((c) => String((c[0] as Error).message));
    expect(sent).toContain("Offline change refused (create)");
    expect(sent.join(" ")).not.toMatch(/Refused one|value too long/);
    await repo.dismissFailed();
    expect((await repo.status()).failed).toHaveLength(0);
  });

  it("stops at a connection problem and keeps the rest for later", async () => {
    const { bank, net, repo } = await setup();
    net.online = false;
    await repo.create([tf("First")]);
    await repo.create([tf("Second")]);
    net.online = true;
    const real = bank.create.bind(bank);
    bank.create = async () => {
      throw new TypeError("Failed to fetch");
    };
    await repo.flushEdits();
    expect((await repo.status()).waiting).toBe(2);
    bank.create = real;
    await repo.flushEdits();
    expect((await repo.status()).waiting).toBe(0);
    expect((await bank.exportAll()).map((q) => q.stem)).toEqual(
      expect.arrayContaining(["First", "Second"]),
    );
  });

  it("will not wipe the device while changes are unsent, unless told to", async () => {
    const { bank, net, repo } = await setup();
    net.online = false;
    await repo.create([tf("Not sent yet")]);
    const err = await repo.clear().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnsentChangesError);
    expect((err as UnsentChangesError).summaries[0]).toContain("Not sent yet");
    expect((await repo.status()).count).toBeGreaterThan(0); // nothing was wiped
    await repo.clear({ discardUnsent: true });
    expect((await repo.status()).waiting).toBe(0);
    expect((await bank.exportAll()).map((q) => q.stem)).not.toContain("Not sent yet");
  });

  it("sends waiting changes first when signing out online", async () => {
    const { bank, net, repo } = await setup();
    net.online = false;
    await repo.create([tf("Sent at sign-out")]);
    net.online = true;
    await repo.clear();
    expect((await bank.exportAll()).map((q) => q.stem)).toContain("Sent at sign-out");
  });

  it("saves waiting changes as a file that imports back", async () => {
    const { net, repo } = await setup();
    expect(await repo.exportPending()).toBeNull();
    net.online = false;
    await repo.create([tf("Kept in a file", ["Anatomy"], ["core"])]);
    await repo.bulk([(await repo.list(DEFAULT_QUERY)).items[1]!.id], { kind: "archive" });
    const file = await repo.exportPending();
    const parsed = JSON.parse(file!) as { questions: unknown[]; otherChanges: string[] };
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.otherChanges).toEqual(["archive 1 question"]);
    const rep = analyzeImport(file!, "json", new Set());
    expect(rep.ok && rep.rows.map((r) => r.input.stem)).toEqual(["Kept in a file"]);
  });

  it("sets aside an unreadable saved list instead of replaying it", async () => {
    const { store, make } = await setup();
    await store.set("u:u1:edits", [
      { kind: "create", id: "x", input: tf("fine") },
      { kind: "create", id: "y", input: { stem: "right name, wrong shape" } },
      { kind: "wat" },
      "junk",
    ]);
    const fresh = make();
    const status = await fresh.status();
    expect(status.waiting).toBe(1);
    expect(status.failed[0]!.message).toMatch(/could not be read/);
    expect(status.failed[0]!.summary).toBe("3 saved changes");
    await store.set("u:u1:edits", "not a list");
    const again = await make().status();
    expect(again.waiting).toBe(0);
  });

  it("keeps one account's waiting changes away from another's", async () => {
    const bank = await seededBank();
    const store = new MemoryStore();
    const a = new OfflineAwareRepo(bank, store, "alice", () => false);
    const b = new OfflineAwareRepo(bank, store, "bob", () => false);
    await new OfflineAwareRepo(bank, store, "alice", () => true).download();
    await new OfflineAwareRepo(bank, store, "bob", () => true).download();
    await a.create([tf("Alice only")]);
    expect((await b.status()).waiting).toBe(0);
    expect(await stems(b)).not.toContain("Alice only");
    expect((await a.status()).waiting).toBe(1);
  });

  it("keeps every question in the copy, however many there are", async () => {
    const bank = new MemoryRepo();
    const N = 1300; // more than two pages of 500
    for (let i = 0; i < N; i += 500) {
      await bank.create(Array.from({ length: Math.min(500, N - i) }, (_, k) => tf(`Q ${i + k}`)));
    }
    const pack = await buildPack(bank);
    expect(pack.questions).toHaveLength(N);
    expect(new Set(pack.questions.map((q) => q.id)).size).toBe(N);
  });

  it("saves only the waiting list after an edit, not the whole copy", async () => {
    const { store, net, repo } = await setup();
    net.online = false;
    const writes: string[] = [];
    const realSet = store.set.bind(store);
    store.set = async (k: string, v: unknown) => {
      writes.push(k);
      return realSet(k, v);
    };
    await repo.create([tf("Cheap to save")]);
    expect(writes.filter((k) => k.endsWith(":pack"))).toEqual([]);
    expect(writes).toContain("u:u1:edits");
  });
});
