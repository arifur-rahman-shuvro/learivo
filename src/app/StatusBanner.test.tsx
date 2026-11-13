import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import StatusBanner from "./StatusBanner.tsx";

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
};

describe("StatusBanner", () => {
  afterEach(() => {
    cleanup();
    setOnline(true);
  });

  it("shows nothing while online", () => {
    render(<StatusBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tells the student when the device goes offline and hides it again", () => {
    render(<StatusBanner />);
    act(() => setOnline(false));
    expect(screen.getByRole("status").textContent).toMatch(/offline/i);
    act(() => setOnline(true));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
