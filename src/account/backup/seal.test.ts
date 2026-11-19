import { describe, expect, it } from "vitest";
import { isSealed, seal, unseal } from "./seal.ts";

describe("backup passphrase", () => {
  it("round-trips and hides the content", async () => {
    const file = await seal('{"secret":"cardiology"}', "correct horse");
    expect(isSealed(file)).toBe(true);
    expect(file).not.toContain("cardiology");
    expect(await unseal(file, "correct horse")).toBe('{"secret":"cardiology"}');
  });

  it("refuses a wrong passphrase and damaged files", async () => {
    const file = await seal("hello", "correct horse");
    await expect(unseal(file, "wrong one")).rejects.toThrow(/does not open/);
    const bad = JSON.parse(file) as { data: string };
    bad.data = bad.data.slice(0, -6) + "AAAAAA";
    await expect(unseal(JSON.stringify(bad), "correct horse")).rejects.toThrow(/damaged/);
  });

  it("does not mistake a plain backup or other text for a protected one", () => {
    expect(isSealed('{"format":"learivo-backup","version":2}')).toBe(false);
    expect(isSealed("nonsense")).toBe(false);
  });
});
