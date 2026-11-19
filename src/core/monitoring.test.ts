import { describe, expect, it } from "vitest";
import { scrub, startMonitoring } from "./monitoring.ts";

describe("monitoring", () => {
  it("does nothing without a DSN", async () => {
    expect(await startMonitoring("")).toBe(false);
  });
  it("removes user, request and breadcrumb data from events", () => {
    const e = scrub({
      user: { email: "a@b.c" },
      request: { url: "x" },
      breadcrumbs: [1],
      message: "boom",
    });
    expect(e).toEqual({ message: "boom" });
  });
});
