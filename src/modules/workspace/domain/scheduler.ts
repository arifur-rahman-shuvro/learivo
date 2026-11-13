/**
 * Spaced repetition for revision cards.
 *
 * This follows the published FSRS-4.5 memory model with its default parameters: each card has a
 * stability (days until recall drops to 90%) and a difficulty (1 to 10). It has not been tuned
 * to this student's own history, so treat the intervals as a sensible default, not a promise.
 */

/** 1 = Again, 2 = Hard, 3 = Good, 4 = Easy. */
export type Rating = 1 | 2 | 3 | 4;
export const RATINGS: readonly Rating[] = [1, 2, 3, 4];
export const RATING_LABEL: Record<Rating, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

export interface Card {
  state: "new" | "review";
  /** ISO time the card is next due. */
  due: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: string | null;
}

const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072,
  0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;
const DECAY = -0.5;
const FACTOR = 19 / 81;
export const DEFAULT_RETENTION = 0.9;
const MAX_DAYS = 36500;
const DAY_MS = 86_400_000;
/** After "Again" the card comes back in this many minutes. */
export const RELEARN_MINUTES = 10;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function newCard(now: Date): Card {
  return {
    state: "new",
    due: now.toISOString(),
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
  };
}

/** Chance of recalling the card after `days` days, given its stability. */
export function retrievability(days: number, stability: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, days)) / stability, DECAY);
}

const initialDifficulty = (g: Rating) => clamp(W[4] - (g - 3) * W[5], 1, 10);

function nextDifficulty(d: number, g: Rating): number {
  const moved = d - W[6] * (g - 3);
  // Pull back towards the starting difficulty so a card never gets stuck at an extreme.
  return clamp(W[7] * initialDifficulty(3) + (1 - W[7]) * moved, 1, 10);
}

function recallStability(d: number, s: number, r: number, g: Rating): number {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return (
    s *
    (1 +
      Math.exp(W[8]) *
        (11 - d) *
        Math.pow(s, -W[9]) *
        (Math.exp(W[10] * (1 - r)) - 1) *
        hard *
        easy)
  );
}

function forgetStability(d: number, s: number, r: number): number {
  return Math.min(
    s,
    W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)),
  );
}

/** Days until recall falls to `retention`, at least 1. */
export function intervalDays(stability: number, retention = DEFAULT_RETENTION): number {
  const days = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, MAX_DAYS);
}

interface Next {
  stability: number;
  difficulty: number;
}

function memoryAfter(card: Card, g: Rating, now: Date): Next {
  if (card.state === "new") {
    return { stability: Math.max(0.01, W[g - 1]!), difficulty: initialDifficulty(g) };
  }
  const elapsed = card.lastReview
    ? Math.max(0, (now.getTime() - new Date(card.lastReview).getTime()) / DAY_MS)
    : 0;
  const r = retrievability(elapsed, card.stability);
  const difficulty = nextDifficulty(card.difficulty, g);
  const stability =
    g === 1
      ? forgetStability(card.difficulty, card.stability, r)
      : recallStability(card.difficulty, card.stability, r, g);
  return { stability: Math.max(0.01, stability), difficulty };
}

/** Days for Hard, Good and Easy. They always rise in that order. */
function passIntervals(card: Card, now: Date): { 2: number; 3: number; 4: number } {
  const hard = intervalDays(memoryAfter(card, 2, now).stability);
  const good = Math.max(intervalDays(memoryAfter(card, 3, now).stability), hard + 1);
  const easy = Math.max(intervalDays(memoryAfter(card, 4, now).stability), good + 1);
  return { 2: Math.min(hard, good - 1), 3: good, 4: easy };
}

/** What each button would do, for the labels on the buttons: minutes for Again, days for the rest. */
export function preview(
  card: Card,
  now: Date,
): Record<Rating, { minutes: number } | { days: number }> {
  const p = passIntervals(card, now);
  return {
    1: { minutes: RELEARN_MINUTES },
    2: { days: p[2] },
    3: { days: p[3] },
    4: { days: p[4] },
  };
}

export function describeInterval(i: { minutes: number } | { days: number }): string {
  if ("minutes" in i) return `${i.minutes} min`;
  if (i.days < 30) return `${i.days} day${i.days === 1 ? "" : "s"}`;
  if (i.days < 365) return `${Math.round(i.days / 30)} mo`;
  return `${(i.days / 365).toFixed(1)} yr`;
}

/** The card after the student rated it. */
export function review(card: Card, rating: Rating, now: Date): Card {
  const next = memoryAfter(card, rating, now);
  const due =
    rating === 1
      ? new Date(now.getTime() + RELEARN_MINUTES * 60_000)
      : new Date(now.getTime() + passIntervals(card, now)[rating] * DAY_MS);
  return {
    state: "review",
    due: due.toISOString(),
    stability: next.stability,
    difficulty: next.difficulty,
    reps: card.reps + 1,
    lapses: card.lapses + (rating === 1 && card.state === "review" ? 1 : 0),
    lastReview: now.toISOString(),
  };
}

export const isDue = (card: Pick<Card, "due">, now: Date) =>
  new Date(card.due).getTime() <= now.getTime();
