import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { Dialog } from "../overlays/Dialog.tsx";

let fail = true;
function Bomb({ message = "x is undefined" }: { message?: string }) {
  if (fail) throw new Error(message);
  return <p>All good</p>;
}

beforeEach(() => {
  fail = true;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("keeps a crash inside its panel and lets the student try again", () => {
    render(
      <>
        <p>Menu stays</p>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </>,
    );
    expect(screen.getByText("Menu stays")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Something went wrong on this screen.");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("All good")).toBeTruthy();
  });

  it("clears the message when the student moves to another screen", () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="home">
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    fail = false;
    rerender(
      <ErrorBoundary resetKey="practice">
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeTruthy();
  });

  it("explains a lost connection and an ended session differently", () => {
    const { unmount } = render(
      <ErrorBoundary>
        <Bomb message="Failed to fetch dynamically imported module" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("connection dropped");
    unmount();
    render(
      <ErrorBoundary>
        <Bomb message="JWT expired" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("session has ended");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in again" })).toBeTruthy();
  });

  it("offers only a reload for a whole-page failure", () => {
    render(
      <ErrorBoundary page>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reload the app" })).toBeTruthy();
  });

  it("a crash inside a dialog stays in the dialog, which can still be closed", () => {
    const onClose = vi.fn();
    render(
      <>
        <p>Screen behind</p>
        <Dialog open title="Organize" onClose={onClose}>
          <Bomb />
        </Dialog>
      </>,
    );
    expect(screen.getByText("Screen behind")).toBeTruthy();
    const dialog = screen.getByRole("dialog", { name: "Organize" });
    expect(dialog.textContent).toContain("Something went wrong");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("All good")).toBeTruthy();
  });
});
