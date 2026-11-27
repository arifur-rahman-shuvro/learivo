import { describe, expect, it } from "vitest";
import { MODULES, moduleForHash, visibleModules } from "./registry.ts";

describe("module registry", () => {
  it("has unique ids and routes", () => {
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.route)).size).toBe(MODULES.length);
  });

  it("shows the five main modules in order, and keeps Focus timer and Mini games reachable", () => {
    expect(visibleModules().map((m) => m.id)).toEqual([
      "home",
      "questions",
      "practice",
      "review",
      "insights",
    ]);
    expect(moduleForHash("#/study").id).toBe("study");
    expect(moduleForHash("#/games").id).toBe("games");
    expect(moduleForHash("#/games").navParent).toBe("home");
  });

  it("resolves a hash and falls back to Home", () => {
    expect(moduleForHash("#/practice").id).toBe("practice");
    expect(moduleForHash("#/review/notes").id).toBe("review");
    expect(moduleForHash("#/reviewer").id).toBe("home");
    expect(moduleForHash("#/nope").id).toBe("home");
    expect(moduleForHash("").id).toBe("home");
  });
});
