import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { describeError, isQuiet } from "./errors.ts";
import { installGlobalErrorHandlers } from "./globalErrors.ts";
import { dismissToast, useToast } from "./toast.ts";

afterEach(() => {
  cleanup();
  dismissToast();
});

describe("describeError", () => {
  it("tells a lost connection from an ended session from anything else", () => {
    expect(describeError(new TypeError("Failed to fetch")).kind).toBe("network");
    expect(describeError(new Error("Failed to fetch dynamically imported module")).kind).toBe(
      "network",
    );
    expect(describeError(new Error("JWT expired")).kind).toBe("session");
    expect(describeError(new Error("Invalid Refresh Token")).kind).toBe("session");
    const other = describeError(new Error("x is undefined"));
    expect(other.kind).toBe("unknown");
    expect(other.advice).toMatch(/saved data is not affected/);
  });

  it("ignores cancellations", () => {
    expect(isQuiet(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isQuiet(new Error("real problem"))).toBe(false);
  });
});

describe("unhandled failures", () => {
  const reject = (reason: unknown) => {
    const ev = new Event("unhandledrejection") as Event & { reason: unknown };
    ev.reason = reason;
    window.dispatchEvent(ev);
  };

  it("shows one plain message, not a stack of them", () => {
    const off = installGlobalErrorHandlers();
    const { result } = renderHook(() => useToast());
    act(() => reject(new TypeError("Failed to fetch")));
    expect(result.current?.message).toContain("connection dropped");
    const first = result.current?.id;
    act(() => reject(new Error("another")));
    expect(result.current?.id).toBe(first); // within five seconds: no second message
    off();
  });

  it("stays silent for cancellations", () => {
    const off = installGlobalErrorHandlers();
    const { result } = renderHook(() => useToast());
    act(() => reject(new DOMException("Aborted", "AbortError")));
    expect(result.current).toBeNull();
    off();
  });
});
