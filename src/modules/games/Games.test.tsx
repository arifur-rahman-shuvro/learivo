import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GamesScreen, { GAMES } from "./GamesScreen.tsx";
import { Tile } from "../../ui-kit/index.ts";

describe("Mini games", () => {
  it("lists every game as Coming soon, none playable, and goes back to Practice", () => {
    const go = vi.fn();
    render(<GamesScreen onNavigate={go} />);
    expect(screen.getByRole("heading", { level: 1, name: "Mini games" })).toBeTruthy();
    expect(screen.getAllByText("Coming soon")).toHaveLength(GAMES.length);
    // coming-soon tiles are not buttons: only Back is clickable
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Practice/ }));
    expect(go).toHaveBeenCalledWith("#/practice");
  });
});

describe("Tile", () => {
  it("shows a count for screen readers and opens on click; hides a zero count", () => {
    const open = vi.fn();
    const { rerender } = render(
      <Tile icon={null} title="Due now" count={3} countLabel="due" onClick={open} />,
    );
    expect(screen.getByRole("button", { name: /Due now/ }).textContent).toContain("3");
    expect(screen.getByText("due")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Due now/ }));
    expect(open).toHaveBeenCalledTimes(1);
    rerender(<Tile icon={null} title="Due now" count={0} onClick={open} />);
    expect(screen.queryByText("0")).toBeNull();
  });
});
