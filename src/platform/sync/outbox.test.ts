import { describe, expect, it } from "vitest";
import { Outbox, resolveChange, type PendingChange } from "./outbox.ts";

const change = (over: Partial<PendingChange> = {}): PendingChange => ({
  id: "c1",
  table: "user_preferences",
  rowId: "u1",
  baseVersion: 3,
  fields: { theme: "forest" },
  createdAt: 100,
  ...over,
});

describe("Outbox", () => {
  it("queues changes and ignores a repeated id", () => {
    const box = new Outbox();
    expect(box.enqueue(change())).toBe(true);
    expect(box.enqueue(change())).toBe(false);
    expect(box.size).toBe(1);
  });

  it("returns pending changes oldest first", () => {
    const box = new Outbox();
    box.enqueue(change({ id: "b", createdAt: 200 }));
    box.enqueue(change({ id: "a", createdAt: 100 }));
    expect(box.pending().map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("removes a change once done", () => {
    const box = new Outbox();
    box.enqueue(change());
    box.markDone("c1");
    expect(box.size).toBe(0);
  });
});

describe("resolveChange", () => {
  it("accepts when the base version matches", () => {
    expect(resolveChange(change(), { version: 3, changedFieldsSinceBase: [] })).toEqual({
      kind: "accept",
      version: 4,
    });
  });

  it("merges when the server changed different fields", () => {
    const r = resolveChange(change(), { version: 5, changedFieldsSinceBase: ["mode"] });
    expect(r).toEqual({ kind: "merge", fields: { theme: "forest" } });
  });

  it("reports a conflict when the same field changed", () => {
    const r = resolveChange(change(), { version: 5, changedFieldsSinceBase: ["theme", "mode"] });
    expect(r).toEqual({ kind: "conflict", fields: ["theme"] });
  });
});
