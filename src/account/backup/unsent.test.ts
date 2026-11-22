import { describe, expect, it, vi } from "vitest";
import { unsentBeforeBackup } from "./unsent.ts";

describe("unsentBeforeBackup", () => {
  it("has nothing to report without offline support", async () => {
    expect(await unsentBeforeBackup(null)).toEqual([]);
  });

  it("sends waiting changes first, then lists only what is still waiting", async () => {
    const order: string[] = [];
    let packLeft = ["Edit: Q1"];
    const parts = {
      pack: {
        flushEdits: vi.fn(async () => {
          order.push("pack");
          packLeft = [];
        }),
        pendingSummaries: vi.fn(async () => {
          order.push("packList");
          return packLeft;
        }),
      },
      ws: {
        flush: vi.fn(async () => {
          order.push("ws");
        }),
        pendingSummaries: vi.fn(async () => ["Note: Heart"]),
      },
    };
    expect(await unsentBeforeBackup(parts)).toEqual(["Note: Heart"]);
    expect(order).toEqual(["pack", "ws", "packList"]);
  });

  it("still reports when sending fails", async () => {
    const parts = {
      pack: {
        flushEdits: vi.fn(() => Promise.reject(new Error("offline"))),
        pendingSummaries: vi.fn(async () => ["Edit: Q1"]),
      },
      ws: null,
    };
    expect(await unsentBeforeBackup(parts)).toEqual(["Edit: Q1"]);
  });
});
