import { describe, expect, it } from "vitest";
import {
  LINES,
  botMove,
  bestMoves,
  emptyBoard,
  freeCells,
  isFull,
  place,
  turnOf,
  winnerOf,
  other,
  type Board,
  type Mark,
} from "./rules.ts";

const board = (s: string): Board =>
  [...s.replace(/\s/g, "")].map((c) => (c === "." ? null : (c as Mark)));
const first = () => 0;

describe("tic-tac-toe rules", () => {
  it("finds a win on each of the eight lines, for both marks", () => {
    // written out by hand on purpose: three rows, three columns, two diagonals
    const expected = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    expect(LINES).toEqual(expected);
    for (const line of expected) {
      for (const m of ["X", "O"] as const) {
        const b = emptyBoard().slice();
        for (const i of line) b[i] = m;
        expect(winnerOf(b)).toEqual({ mark: m, line });
      }
    }
  });

  it("does not call two in a row, or a full board with no line, a win", () => {
    expect(winnerOf(board("XX. ... ..."))).toBeNull();
    const draw = board("XOX XOO OXX");
    expect(winnerOf(draw)).toBeNull();
    expect(isFull(draw)).toBe(true);
  });

  it("ignores a move on a taken cell, off the board, or after the game ended", () => {
    const b = place(emptyBoard(), 4, "X");
    expect(place(b, 4, "O")).toBe(b);
    expect(place(b, 9, "O")).toBe(b);
    expect(place(b, -1, "O")).toBe(b);
    const won = board("XXX OO. ...");
    expect(place(won, 5, "O")).toBe(won);
  });

  it("works out whose turn it is, X first", () => {
    expect(turnOf(emptyBoard())).toBe("X");
    expect(turnOf(board("X.. ... ..."))).toBe("O");
    expect(turnOf(board("XO. ... ..."))).toBe("X");
  });
});

describe("bot", () => {
  it("medium wins when it can and blocks when it must", () => {
    expect(botMove(board("OO. XX. ..."), "O", "medium", first)).toBe(2);
    expect(botMove(board("XX. O.. ..."), "O", "medium", first)).toBe(2);
  });

  it("easy plays only on free cells", () => {
    const b = board("XOX OXO O..");
    for (let r = 0; r < 20; r++)
      expect(freeCells(b)).toContain(botMove(b, "X", "easy", () => r / 20));
  });

  it("hard takes a win and blocks a loss", () => {
    expect(bestMoves(board("OO. XX. X.."), "O")).toEqual([2]);
    expect(bestMoves(board("XX. O.. ..."), "O")).toEqual([2]);
  });

  it("hard never loses: against every possible human game, as O and as X", () => {
    let games = 0;
    const walk = (b: Board, bot: Mark) => {
      const w = winnerOf(b);
      if (w) {
        games++;
        expect(w.mark).toBe(bot); // a finished game is only ever a bot win or (below) a draw
        return;
      }
      if (isFull(b)) {
        games++;
        return;
      }
      const t = turnOf(b);
      if (t === bot) walk(place(b, botMove(b, bot, "hard", first), bot), bot);
      else for (const i of freeCells(b)) walk(place(b, i, other(bot)), bot);
    };
    walk(emptyBoard(), "O");
    walk(emptyBoard(), "X");
    expect(games).toBeGreaterThan(100); // really walked the whole tree, not just a few lines
  });
});
