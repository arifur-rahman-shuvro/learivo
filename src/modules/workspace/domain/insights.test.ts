import { describe, expect, it } from "vitest";

describe("speedByArea", () => {
  const fact = (name: string, seconds: number) => ({
    at: "2026-11-17T10:00:00Z",
    path: [name],
    correct: true,
    seconds,
  });
  it("averages seconds per subject, slowest first, and skips thin or untimed areas", async () => {
    const { speedByArea } = await import("./insights.ts");
    const facts = [
      ...Array.from({ length: 5 }, () => fact("Anatomy", 30)),
      ...Array.from({ length: 5 }, () => fact("Physiology", 60)),
      ...Array.from({ length: 4 }, () => fact("Few", 99)),
      ...Array.from({ length: 6 }, () => fact("Untimed", 0)),
    ];
    expect(speedByArea(facts).map((r) => [r.name, r.average])).toEqual([
      ["Physiology", 60],
      ["Anatomy", 30],
    ]);
  });
});
