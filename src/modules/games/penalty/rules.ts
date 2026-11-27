/**
 * Penalty shootout rules. Plain TypeScript, no React. Every roll of the dice comes from an injected
 * `rnd`, so tests can force any outcome.
 *
 * The goal is a grid of six zones: three columns (left, middle, right) and two rows (top, low).
 * A shooter picks a zone and a power; a keeper picks a zone to dive to.
 */

export type Col = 0 | 1 | 2;
export type Row = 0 | 1; // 0 = top, 1 = low
export interface Zone {
  col: Col;
  row: Row;
}
/** 1 soft, 2 medium, 3 hard. Harder is harder to save and easier to miss. */
export type Power = 1 | 2 | 3;
export type Outcome = "goal" | "saved" | "miss";
export type Side = "you" | "bot";

export const ZONES: readonly Zone[] = [
  { col: 0, row: 0 },
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 0, row: 1 },
  { col: 1, row: 1 },
  { col: 2, row: 1 },
];

export const COLS = ["left", "middle", "right"] as const;
export const ROWS = ["Top", "Low"] as const;

export const zoneName = (z: Zone): string => `${ROWS[z.row]} ${COLS[z.col]}`;

export const sameZone = (a: Zone, b: Zone): boolean => a.col === b.col && a.row === b.row;

/** Chance a hard shot goes wide or over. Soft shots never miss. */
export const MISS_CHANCE: Record<Power, number> = { 1: 0, 2: 0.04, 3: 0.15 };
/** Chance the keeper saves when he dives to the very zone. */
export const SAVE_SAME_ZONE: Record<Power, number> = { 1: 0.95, 2: 0.8, 3: 0.6 };
/** Chance of a fingertip save when he dives one zone away. */
export const SAVE_NEXT_ZONE: Record<Power, number> = { 1: 0.35, 2: 0.2, 3: 0.1 };

/** Steps between two zones, counting a column or a row change as one step each. */
export const distance = (a: Zone, b: Zone): number =>
  Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

export function resolveKick(aim: Zone, power: Power, dive: Zone, rnd: () => number): Outcome {
  if (rnd() < MISS_CHANCE[power]) return "miss";
  const d = distance(aim, dive);
  const save = d === 0 ? SAVE_SAME_ZONE[power] : d === 1 ? SAVE_NEXT_ZONE[power] : 0;
  return save > 0 && rnd() < save ? "saved" : "goal";
}

const pickFrom = <T>(list: readonly T[], rnd: () => number): T =>
  list[Math.min(list.length - 1, Math.floor(rnd() * list.length))]!;

/** The computer keeper dives anywhere, all six zones equally likely. */
export const botDive = (rnd: () => number): Zone => pickFrom(ZONES, rnd);

/** The computer shooter likes the corners and mixes its power. */
export function botShot(rnd: () => number): { aim: Zone; power: Power } {
  const corners = ZONES.filter((z) => z.col !== 1);
  const aim = rnd() < 0.7 ? pickFrom(corners, rnd) : pickFrom(ZONES, rnd);
  const power = pickFrom([1, 2, 2, 3] as const, rnd);
  return { aim, power };
}

export interface Kick {
  shooter: Side;
  aim: Zone;
  power: Power;
  dive: Zone;
  outcome: Outcome;
}

export const REGULATION = 5;
/** After this many kicks each, a tie is called a draw so a match always ends. */
export const MAX_KICKS = 10;

export interface Match {
  you: number;
  bot: number;
  youTaken: number;
  botTaken: number;
  /** Who shoots next, or null when the match is over. */
  next: Side | null;
  over: boolean;
  winner: Side | "draw" | null;
  suddenDeath: boolean;
}

/**
 * Where the match stands after the kicks so far. You shoot first, then the bot, five each. The match
 * stops early when the one behind can no longer catch up. A tie after five each goes to sudden death,
 * one kick each, until one side is ahead after a full pair (or MAX_KICKS each ends it in a draw).
 */
export function matchState(kicks: readonly Kick[]): Match {
  const mine = kicks.filter((k) => k.shooter === "you");
  const theirs = kicks.filter((k) => k.shooter === "bot");
  const you = mine.filter((k) => k.outcome === "goal").length;
  const bot = theirs.filter((k) => k.outcome === "goal").length;
  const youTaken = mine.length;
  const botTaken = theirs.length;
  const base = {
    you,
    bot,
    youTaken,
    botTaken,
    suddenDeath: youTaken >= REGULATION && botTaken >= REGULATION,
  };

  let winner: Match["winner"] = null;
  if (youTaken < REGULATION || botTaken < REGULATION) {
    // Regulation: over once one side is out of reach of the other's remaining kicks.
    if (you > bot + (REGULATION - botTaken)) winner = "you";
    else if (bot > you + (REGULATION - youTaken)) winner = "bot";
  } else if (youTaken === botTaken && you !== bot) winner = you > bot ? "you" : "bot";
  else if (youTaken === botTaken && youTaken >= MAX_KICKS) winner = "draw";

  if (winner) return { ...base, next: null, over: true, winner };
  return { ...base, next: youTaken === botTaken ? "you" : "bot", over: false, winner: null };
}
