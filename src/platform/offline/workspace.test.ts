import { describe, expect, it } from "vitest";
import { MemoryWorkspace } from "../../modules/workspace/data/memoryWorkspace.ts";
import { newCard } from "../../modules/workspace/domain/scheduler.ts";
import { MemoryStore } from "./store.ts";
import { OfflineWorkspace, applyWs, enqueueWs, type WsOp } from "./workspace.ts";

async function setup() {
  const remote = new MemoryWorkspace();
  const store = new MemoryStore();
  const net = { online: true };
  const make = () => new OfflineWorkspace(remote, store, "u1", () => net.online);
  const ws = make();
  return { remote, store, net, make, ws };
}

describe("OfflineWorkspace", () => {
  it("passes reads and writes straight through while online", async () => {
    const { remote, ws } = await setup();
    await ws.setBookmark("q1", true);
    expect([...(await remote.bookmarks())]).toEqual(["q1"]);
    await ws.setDailyGoal(35);
    expect(await remote.dailyGoal()).toBe(35);
    expect(await ws.waiting()).toBe(0);
  });

  it("keeps working offline from the copy on the device, and sends everything in order later", async () => {
    const { remote, net, ws } = await setup();
    // Open each list once while online, so there is a copy.
    await Promise.all([ws.bookmarks(), ws.notes(), ws.cards(), ws.flashcards(), ws.glossary()]);
    net.online = false;

    await ws.setBookmark("q1", true);
    const note = await ws.saveNote({ id: null, questionId: "q1", title: "T", body: "Remember" });
    const card = await ws.saveFlashcard({ id: null, front: "F", back: "B" });
    const term = await ws.saveTerm({ id: null, term: "Ischaemia", definition: "Low supply" });
    await ws.addCards(["q1", "q2"]);
    await ws.setDailyGoal(40);

    // Shown at once from the device:
    expect([...(await ws.bookmarks())]).toEqual(["q1"]);
    expect((await ws.notes()).map((n) => n.body)).toEqual(["Remember"]);
    expect((await ws.flashcards()).map((f) => f.front)).toEqual(["F"]);
    expect((await ws.glossary()).map((t) => t.term)).toEqual(["Ischaemia"]);
    expect((await ws.cards()).map((c) => c.questionId).sort()).toEqual(["q1", "q2"]);
    expect(await ws.dailyGoal()).toBe(40);
    expect(await ws.waiting()).toBe(6);
    // Not in the account yet:
    expect(await remote.notes()).toHaveLength(0);

    net.online = true;
    await ws.flush();
    expect(await ws.waiting()).toBe(0);
    // Same ids as on the device, so nothing is made twice.
    expect((await remote.notes()).map((n) => n.id)).toEqual([note.id]);
    expect((await remote.flashcards()).map((f) => f.id)).toEqual([card.id]);
    expect((await remote.glossary()).map((t) => t.id)).toEqual([term.id]);
    expect([...(await remote.bookmarks())]).toEqual(["q1"]);
    expect((await remote.cards()).length).toBe(2);
    expect(await remote.dailyGoal()).toBe(40);
  });

  it("an edit made twice offline is one change, and the last one wins", async () => {
    const { remote, net, ws } = await setup();
    await ws.notes();
    net.online = false;
    const n = await ws.saveNote({ id: null, questionId: null, title: "", body: "First" });
    await ws.saveNote({ id: n.id, questionId: null, title: "", body: "Second" });
    await ws.setBookmark("q1", true);
    await ws.setBookmark("q1", false);
    expect(await ws.waiting()).toBe(2);
    net.online = true;
    await ws.flush();
    expect((await remote.notes()).map((x) => x.body)).toEqual(["Second"]);
    expect((await remote.notes())[0]!.id).toBe(n.id); // still the one note, with the id the device gave it
    expect((await remote.bookmarks()).size).toBe(0);
  });

  it("deleting something offline removes it from view and from the account", async () => {
    const { remote, net, ws } = await setup();
    const n = await remote.saveNote({ id: null, questionId: null, title: "", body: "Gone soon" });
    await ws.notes();
    net.online = false;
    await ws.deleteNote(n.id);
    expect(await ws.notes()).toHaveLength(0);
    net.online = true;
    await ws.flush();
    expect(await remote.notes()).toHaveLength(0);
  });

  it("survives closing the app, and says plainly when a list was never opened", async () => {
    const { remote, net, make, ws } = await setup();
    await ws.bookmarks();
    net.online = false;
    await ws.setBookmark("q9", true);
    const again = make(); // a new session on the same device
    expect([...(await again.bookmarks())]).toEqual(["q9"]);
    expect(await again.waiting()).toBe(1);
    await expect(again.notes()).rejects.toThrow("not been opened on this device");
    net.online = true;
    await again.flush();
    expect([...(await remote.bookmarks())]).toEqual(["q9"]);
  });

  it("falls back to the copy when the connection claims to be up but fails, and keeps the change", async () => {
    const { remote, ws } = await setup();
    await ws.bookmarks();
    const real = remote.setBookmark.bind(remote);
    remote.setBookmark = async () => {
      throw new Error("Failed to fetch");
    };
    await ws.setBookmark("q1", true);
    expect(await ws.waiting()).toBe(1);
    remote.setBookmark = real;
    await ws.flush(); // the first try is still finishing
    await ws.flush();
    expect([...(await remote.bookmarks())]).toEqual(["q1"]);
  });

  it("lists a change the account refuses and carries on with the rest", async () => {
    const { remote, net, ws } = await setup();
    await ws.glossary();
    net.online = false;
    await ws.saveTerm({ id: null, term: "A", definition: "a" });
    await ws.setDailyGoal(25);
    net.online = true;
    remote.saveTerm = async () => {
      throw new Error("You already have a term with that name.");
    };
    await ws.flush();
    expect(ws.failed).toEqual(["Glossary: A: You already have a term with that name."]);
    expect(await remote.dailyGoal()).toBe(25);
    expect(await ws.waiting()).toBe(0);
  });

  it("clears its copy and waiting changes on request", async () => {
    const { net, ws, make } = await setup();
    await ws.bookmarks();
    net.online = false;
    await ws.setBookmark("q1", true);
    await ws.clear();
    expect(await make().waiting()).toBe(0);
  });
});

describe("workspace change rules", () => {
  it("replaces earlier changes to the same thing and keeps the rest in order", () => {
    const ops: WsOp[] = [
      { k: "goal", n: 10 },
      { k: "bookmark", q: "a", on: true },
      { k: "removeCard", q: "z" },
    ];
    const q = enqueueWs(enqueueWs(ops, { k: "goal", n: 30 }), { k: "bookmark", q: "a", on: false });
    expect(q).toEqual([
      { k: "removeCard", q: "z" },
      { k: "goal", n: 30 },
      { k: "bookmark", q: "a", on: false },
    ]);
  });

  it("lays a rated card over the cached flashcards without touching its text", () => {
    const base = { ...newCard(new Date("2026-01-01")), id: "f1", front: "F", back: "B" };
    const c = { flashcards: [base] };
    applyWs(c, { k: "rate", id: "f1", card: { ...newCard(new Date()), reps: 3, state: "review" } });
    expect(c.flashcards[0]).toMatchObject({ front: "F", back: "B", reps: 3, state: "review" });
  });
});

describe("OfflineWorkspace.prefetch", () => {
  it("makes a copy of every list, so one never opened online still shows offline", async () => {
    const { remote, net, make } = await setup();
    await remote.saveTerm({ id: null, term: "Ischaemia", definition: "Low supply" });
    await remote.setDailyGoal(33);
    const ws = make();
    await ws.prefetch();
    net.online = false;
    expect((await ws.glossary()).map((t) => t.term)).toEqual(["Ischaemia"]);
    expect(await ws.dailyGoal()).toBe(33);
  });

  it("does nothing while offline", async () => {
    const { net, ws } = await setup();
    net.online = false;
    await expect(ws.prefetch()).resolves.toBeUndefined();
  });
});

describe("OfflineWorkspace note edited on two devices", () => {
  it("tells the student when their version replaced a newer one, and keeps the notice until dismissed", async () => {
    const { remote, net, make } = await setup();
    const first = await remote.saveNote({ id: null, questionId: null, title: "T", body: "v1" });
    const ws = make();
    await ws.notes(); // copy made while online
    net.online = false;
    await ws.saveNote({ id: first.id, questionId: null, title: "T", body: "from phone" });
    // Meanwhile the note is changed somewhere else.
    await new Promise((r) => setTimeout(r, 5));
    await remote.saveNote({ id: first.id, questionId: null, title: "T", body: "from laptop" });
    net.online = true;
    await ws.flush();
    expect((await remote.notes())[0]!.body).toBe("from phone");
    const problems = await ws.problems();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("changed on another device");
    // Kept across a restart of the app:
    expect(await make().problems()).toHaveLength(1);
    await ws.dismissProblems();
    expect(await make().problems()).toEqual([]);
  });

  it("says nothing when nobody else changed the note", async () => {
    const { remote, net, make } = await setup();
    const first = await remote.saveNote({ id: null, questionId: null, title: "T", body: "v1" });
    const ws = make();
    await ws.notes();
    net.online = false;
    await ws.saveNote({ id: first.id, questionId: null, title: "T", body: "edit" });
    net.online = true;
    await ws.flush();
    expect(await ws.problems()).toEqual([]);
  });
});
