/** Tic-tac-toe rules and the bot. Plain TypeScript, no React, so every rule can be unit tested. */

export type Mark = "X" | "O";
export type Cell = Mark | null;
/** Nine cells, row by row: 0 1 2 / 3 4 5 / 6 7 8. */
export type Board = readonly Cell[];
export type Level = "easy" | "medium" | "hard";

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const emptyBoard = (): Board => Array<Cell>(9).fill(null);

export const other = (m: Mark): Mark => (m === "X" ? "O" : "X");

export function winnerOf(b: Board): { mark: Mark; line: readonly number[] } | null {
  for (const line of LINES) {
    const [a, c, d] = line;
    const m = b[a];
    if (m && m === b[c] && m === b[d]) return { mark: m, line };
  }
  return null;
}

export const isFull = (b: Board): boolean => b.every((c) => c !== null);

export const isOver = (b: Board): boolean => winnerOf(b) !== null || isFull(b);

export const freeCells = (b: Board): number[] => b.flatMap((c, i) => (c === null ? [i] : []));

/** A new board with the mark placed. A taken cell or a finished game changes nothing. */
export function place(b: Board, i: number, m: Mark): Board {
  if (i < 0 || i > 8 || b[i] !== null || isOver(b)) return b;
  const next = b.slice();
  next[i] = m;
  return next;
}

/** Whose turn it is: X always starts, so with equal marks it is X's move. */
export function turnOf(b: Board): Mark {
  const x = b.filter((c) => c === "X").length;
  const o = b.filter((c) => c === "O").length;
  return x <= o ? "X" : "O";
}

/** Best score for `bot` if both sides play perfectly from here. Faster wins and slower losses score higher. */
function minimax(b: Board, turn: Mark, bot: Mark, depth: number): number {
  const w = winnerOf(b);
  if (w) return w.mark === bot ? 10 - depth : depth - 10;
  if (isFull(b)) return 0;
  let best = turn === bot ? -Infinity : Infinity;
  for (const i of freeCells(b)) {
    const s = minimax(place(b, i, turn), other(turn), bot, depth + 1);
    best = turn === bot ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}

/** Every cell that is as good as any other for `bot` (all of them tie when the game is already decided). */
export function bestMoves(b: Board, bot: Mark): number[] {
  let best = -Infinity;
  let moves: number[] = [];
  for (const i of freeCells(b)) {
    const s = minimax(place(b, i, bot), other(bot), bot, 1);
    if (s > best) {
      best = s;
      moves = [i];
    } else if (s === best) moves.push(i);
  }
  return moves;
}

function pick(cells: number[], rnd: () => number): number {
  return cells[Math.min(cells.length - 1, Math.floor(rnd() * cells.length))]!;
}

/** The cell that finishes a line for `m`, if there is one. */
function finishing(b: Board, m: Mark): number | null {
  for (const i of freeCells(b)) if (winnerOf(place(b, i, m))?.mark === m) return i;
  return null;
}

/**
 * The bot's move for the chosen level. Easy plays anywhere. Medium wins when it can, blocks when it
 * must, and otherwise plays anywhere. Hard never loses. `rnd` is injected so tests are repeatable.
 */
export function botMove(
  b: Board,
  bot: Mark,
  level: Level,
  rnd: () => number = Math.random,
): number {
  const free = freeCells(b);
  if (free.length === 0) throw new Error("No free cell");
  if (level === "easy") return pick(free, rnd);
  if (level === "medium") {
    const win = finishing(b, bot);
    if (win !== null) return win;
    const block = finishing(b, other(bot));
    if (block !== null) return block;
    return pick(free, rnd);
  }
  return pick(bestMoves(b, bot), rnd);
}
