import { afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFocusMode } from "../../core/focus.ts";
import GamesScreen from "./GamesScreen.tsx";
import { GAMES } from "./registry.tsx";
import { Tile } from "../../ui-kit/index.ts";

describe("Mini games", () => {
  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("opens with two big choices, Brain Gym and Break Room, and goes back to Home", () => {
    const go = vi.fn();
    render(<GamesScreen onNavigate={go} />);
    expect(screen.getByRole("heading", { level: 1, name: "Mini games" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Brain Gym/ }));
    expect(go).toHaveBeenCalledWith("#/games/brain");
    fireEvent.click(screen.getByRole("button", { name: /Break Room/ }));
    expect(go).toHaveBeenCalledWith("#/games/break");
    fireEvent.click(screen.getByRole("button", { name: /Home/ }));
    expect(go).toHaveBeenCalledWith("#/home");
  });

  it.each([
    ["brain", "Brain Gym", "Speed round"],
    ["break", "Break Room", "Tic-tac-toe"],
  ] as const)(
    "%s page lists only its own games, all Coming soon and not clickable",
    (g, title, sample) => {
      window.location.hash = `#/games/${g}`;
      const go = vi.fn();
      render(<GamesScreen onNavigate={go} />);
      expect(screen.getByRole("heading", { level: 1, name: title })).toBeTruthy();
      expect(screen.getByText(sample)).toBeTruthy();
      const own = GAMES.filter((x) => x.group === g);
      expect(own.length).toBeGreaterThanOrEqual(6);
      for (const x of own) expect(screen.getByText(x.title)).toBeTruthy();
      for (const x of GAMES.filter((y) => y.group !== g))
        expect(screen.queryByText(x.title)).toBeNull();
      const soon = own.filter((x) => x.status === "soon");
      expect(screen.getAllByText("Coming soon")).toHaveLength(soon.length);
      expect(screen.getAllByRole("button")).toHaveLength(1 + (own.length - soon.length)); // Back and ready games
      fireEvent.click(screen.getByRole("button", { name: /Mini games/ }));
      expect(go).toHaveBeenCalledWith("#/games");
    },
  );

  it("opens a ready game from its tile and Back returns to the list", async () => {
    window.location.hash = "#/games/break";
    const go = vi.fn((r: string) => {
      window.location.hash = r;
    });
    const { rerender } = render(<GamesScreen onNavigate={go} />);
    fireEvent.click(screen.getByRole("button", { name: /Tic-tac-toe/ }));
    expect(go).toHaveBeenCalledWith("#/games/break/tictactoe");
    rerender(<GamesScreen onNavigate={go} />);
    expect(await screen.findByRole("button", { name: /Two players/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Break Room/ }));
    expect(go).toHaveBeenLastCalledWith("#/games/break");
  });

  it("takes the whole screen on a phone: asks the shell to hide the tab bar and top bar while open, and gives it back when closed", () => {
    let seen = false;
    function Probe() {
      seen = useFocusMode();
      return null;
    }
    render(<Probe />);
    expect(seen).toBe(false);
    const games = render(<GamesScreen onNavigate={vi.fn()} />);
    expect(seen).toBe(true);
    // also while a game itself is open
    window.location.hash = "#/games/break/penalty";
    games.rerender(<GamesScreen onNavigate={vi.fn()} />);
    expect(seen).toBe(true);
    games.unmount();
    expect(seen).toBe(false);
  });

  it("keeps game ids unique so saved scores can rely on them", () => {
    expect(new Set(GAMES.map((x) => x.id)).size).toBe(GAMES.length);
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
