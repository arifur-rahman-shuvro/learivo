import { beforeEach, describe, expect, it } from "vitest";
import { activeConfig, aiState, forgetAllKeys, reloadAi, removeKey, saveAi } from "./keys.ts";

beforeEach(() => {
  localStorage.clear();
  reloadAi();
});

describe("AI key store", () => {
  it("has no connection until a key is saved", () => {
    expect(activeConfig()).toBeNull();
  });

  it("saves a key with the default model when none is typed", () => {
    saveAi("gemini", "  abc  ", "");
    expect(activeConfig()).toEqual({
      provider: "gemini",
      key: "abc",
      model: "gemini-flash-latest",
    });
  });

  it("keeps a key for each provider and uses the chosen one", () => {
    saveAi("gemini", "g", "");
    saveAi("openai", "o", "my-model");
    expect(activeConfig()).toEqual({ provider: "openai", key: "o", model: "my-model" });
    expect(aiState().keys.gemini).toBe("g");
  });

  it("remembers across a reload but only on this device's storage", () => {
    saveAi("anthropic", "a", "");
    reloadAi();
    expect(activeConfig()?.key).toBe("a");
  });

  it("removes one key, or all of them on sign out", () => {
    saveAi("gemini", "g", "");
    saveAi("openai", "o", "");
    removeKey("openai");
    expect(activeConfig()).toBeNull();
    saveAi("openai", "o", "");
    forgetAllKeys();
    expect(aiState().keys).toEqual({});
    expect(localStorage.getItem("learivo.ai")).not.toContain('"o"');
  });

  it("ignores damaged stored data", () => {
    localStorage.setItem("learivo.ai", '{"provider":"bogus","keys":{"x":1}}');
    reloadAi();
    expect(activeConfig()).toBeNull();
    expect(aiState().provider).toBe("gemini");
  });
});
