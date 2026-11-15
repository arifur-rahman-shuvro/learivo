import { describe, expect, it } from "vitest";
import { avatarColor, cleanName, cleanProfile, initials, NAME_MAX } from "./profile.ts";

describe("profile", () => {
  it("cleans a name", () => {
    expect(cleanName("  Sara   Rahman \n")).toBe("Sara Rahman");
    expect(cleanName("x".repeat(100))).toHaveLength(NAME_MAX);
    expect(cleanName("   ")).toBe("");
  });
  it("makes initials from the first and last word", () => {
    expect(initials("Sara")).toBe("S");
    expect(initials("sara  jahan rahman")).toBe("SR");
    expect(initials("")).toBe("");
    expect(initials("  ")).toBe("");
  });
  it("falls back to the first avatar for an unknown one", () => {
    expect(cleanProfile({ displayName: " A ", avatar: "neon" })).toEqual({
      displayName: "A",
      avatar: "sky",
    });
    expect(cleanProfile({ displayName: "A", avatar: "rose" }).avatar).toBe("rose");
    expect(avatarColor("violet")).toBe("#6d28d9");
  });
});
