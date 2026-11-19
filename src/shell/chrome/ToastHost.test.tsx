import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import ToastHost from "./ToastHost.tsx";
import { dismissToast, showToast } from "../../core/toast.ts";

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

  it("shows a button on the toast, runs it once and closes the toast", () => {
    render(<ToastHost />);
    let ran = 0;
    act(() => showToast("3 questions archived", { label: "Undo", run: () => (ran += 1) }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(ran).toBe(1);
    expect(screen.queryByText("3 questions archived")).toBeNull();
  });
});
