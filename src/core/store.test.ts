import { describe, expect, it, vi } from "vitest";
import { createStore } from "./store.ts";

describe("createStore", () => {
  it("holds a value and tells listeners about each real change", () => {
    const s = createStore(1);
    const seen = vi.fn();
    const stop = s.subscribe(seen);
    s.set(2);
    s.set(2); // same value: no notification
    s.set(3);
    expect(s.get()).toBe(3);
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
    s.set(4);
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
