import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import ToastHost from "./ToastHost.tsx";
import { dismissToast, showToast } from "./toast.ts";

afterEach(() => {
  cleanup();
  dismissToast();
  vi.useRealTimers();
});

describe("ToastHost", () => {
  it("shows a message, replaces it with a newer one, and removes it after a few seconds", () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => showToast("3 questions deleted"));
    expect(screen.getByText("3 questions deleted")).toBeTruthy();
    act(() => showToast("Bookmarked"));
    expect(screen.queryByText("3 questions deleted")).toBeNull();
    expect(screen.getByText("Bookmarked")).toBeTruthy();
    act(() => void vi.advanceTimersByTime(4100));
    expect(screen.queryByText("Bookmarked")).toBeNull();
  });
});
