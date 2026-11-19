import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { IndexedDbStore, MemoryStore, type KeyValueStore } from "./store.ts";

const stores: [string, () => KeyValueStore][] = [
  ["memory", () => new MemoryStore()],
  ["IndexedDB", () => new IndexedDbStore(new IDBFactory())],
];

describe.each(stores)("%s store", (_name, make) => {
  it("saves, reads, lists by prefix and deletes", async () => {
    const s = make();
    expect(await s.get("a")).toBeUndefined();
    await s.set("u1:pack", { n: 1, list: [1, 2, 3] });
    await s.set("u1:attempts", "x");
    await s.set("u2:pack", "y");
    expect(await s.get("u1:pack")).toEqual({ n: 1, list: [1, 2, 3] });
    expect((await s.keys("u1:")).sort()).toEqual(["u1:attempts", "u1:pack"]);
    await s.del("u1:pack");
    expect(await s.get("u1:pack")).toBeUndefined();
  });

  it("overwrites an existing key", async () => {
    const s = make();
    await s.set("k", 1);
    await s.set("k", 2);
    expect(await s.get("k")).toBe(2);
  });
});

it("keeps data when the store is opened again", async () => {
  const factory = new IDBFactory();
  await new IndexedDbStore(factory).set("k", { ok: true });
  expect(await new IndexedDbStore(factory).get("k")).toEqual({ ok: true });
});
