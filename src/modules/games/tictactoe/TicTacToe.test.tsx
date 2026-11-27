import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicTacToe from "./TicTacToe.tsx";

const cell = (r: number, c: number, what = "empty") =>
  screen.getByRole("button", { name: `Row ${r}, column ${c}, ${what}` });
const tap = (...cells: [number, number][]) =>
  cells.forEach(([r, c]) => fireEvent.click(cell(r, c)));
const status = () => screen.getByTestId("status").textContent;
const think = () => act(() => void vi.advanceTimersByTime(500));

function setup() {
  const exit = vi.fn();
  const finish = vi.fn();
  render(<TicTacToe onExit={exit} onFinish={finish} />);
  return { exit, finish };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Tic-tac-toe screen", () => {
  it("two players: X takes a row, the win is announced, counted once and reported once", () => {
    const { finish } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Two players/ }));
    expect(status()).toBe("X's turn");
    tap([1, 1], [2, 1], [1, 2], [2, 2], [1, 3]);
    expect(status()).toBe("X wins");
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0]![0]).toMatchObject({ gameId: "tictactoe", score: 3 });
    expect(screen.getByText("X", { selector: "dt" }).previousSibling?.textContent).toBe("1");
    expect(screen.getByText("O", { selector: "dt" }).previousSibling?.textContent).toBe("0");
    // a finished board takes no more moves
    fireEvent.click(cell(3, 3));
    expect(cell(3, 3)).toBeTruthy();
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("a draw is announced and scores 1; Play again starts a fresh board and keeps the tally", () => {
    const { finish } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Two players/ }));
    // X O X / X O O / O X X
    tap([1, 1], [1, 2], [1, 3], [2, 2], [2, 1], [2, 3], [3, 2], [3, 1], [3, 3]);
    expect(status()).toBe("A draw");
    expect(finish.mock.calls[0]![0]).toMatchObject({ score: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(status()).toBe("X's turn");
    expect(screen.getAllByRole("button", { name: /empty/ })).toHaveLength(9);
    expect(screen.getByText("Draws").previousSibling?.textContent).toBe("1");
  });

  it("against a bot you move, the bot answers after a moment, and you cannot move while it thinks", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Hard bot/ }));
    expect(status()).toBe("Your turn (X)");
    tap([2, 2]);
    expect(status()).toBe("The bot is thinking");
    tap([1, 1]); // ignored: it is the bot's turn
    expect(cell(1, 1)).toBeTruthy();
    think();
    expect(screen.getAllByRole("button", { name: /, O$/ })).toHaveLength(1);
    expect(status()).toBe("Your turn (X)");
  });

  it("the first move alternates: in round two the bot opens", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Medium bot/ }));
    // Lose-proof way to end round one quickly: let the human win on a medium bot is not certain, so
    // play on until the board is over, always taking the first free cell.
    for (let n = 0; n < 9 && !/win|draw/i.test(status() ?? ""); n++) {
      const free = screen.queryAllByRole("button", { name: /empty$/ });
      if (free.length === 0) break;
      fireEvent.click(free[0]!);
      think();
    }
    expect(/win|draw/i.test(status() ?? "")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(status()).toBe("The bot is thinking");
    think();
    expect(screen.getAllByRole("button", { name: /, X$/ })).toHaveLength(1);
    expect(status()).toBe("Your turn (O)");
  });

  it("leaving while the bot is thinking stops its move cleanly", () => {
    const { exit } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Easy bot/ }));
    tap([1, 1]);
    cleanup(); // the screen is closed before the bot moves
    expect(() => act(() => void vi.advanceTimersByTime(1000))).not.toThrow();
    expect(exit).not.toHaveBeenCalled();
  });

  it("Back goes to the opponent list first, then out to the Break Room", () => {
    const { exit } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Two players/ }));
    fireEvent.click(screen.getByRole("button", { name: /Choose opponent/ }));
    expect(screen.getByRole("button", { name: /Hard bot/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Break Room/ }));
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
