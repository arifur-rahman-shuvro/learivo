import {
  DIFFICULTIES,
  MIN_SPEED_MS,
  RAMP_FLOOR,
  RAMP_MS_PER_BALL,
  RUN_UP_MS,
  SPEED_FACTOR,
  TIMING,
  type DeliveryType,
  type Difficulty,
  type Rnd,
} from "./config.ts";

export type Timing = "perfect" | "good" | "average" | "poor" | "miss";

export const TIMING_WORD: Record<Timing, string> = {
  perfect: "PERFECT",
  good: "GOOD",
  average: "AVERAGE",
  poor: "POOR",
  miss: "MISSED",
};

/** Sorts a swing by how far it was from the perfect moment. Negative offset = early, positive = late. */
export function classify(offsetMs: number, d: Difficulty): Timing {
  const off = Math.abs(offsetMs);
  const s = DIFFICULTIES[d].windowScale;
  if (off <= TIMING.perfect * s) return "perfect";
  if (off <= TIMING.good * s) return "good";
  if (off <= TIMING.average * s) return "average";
  if (off <= TIMING.miss * s) return "poor";
  return "miss";
}

/** After this long past the perfect moment with no swing, the ball is through. */
export function missWindowMs(d: Difficulty): number {
  return TIMING.miss * DIFFICULTIES[d].windowScale;
}

export interface Delivery {
  type: DeliveryType;
  /** Run-up time before the ball is released. */
  delayMs: number;
  /** Release to the ball reaching the bat. */
  speedMs: number;
  /** -1 or 1: which way a swinging ball curves; 0 for the others. */
  swing: -1 | 0 | 1;
}

const ORDER: DeliveryType[] = ["normal", "slow", "fast", "swing"];

/** Dice order: delivery type, run-up, swing direction. `ballIndex` is how many balls were faced already. */
export function newDelivery(ballIndex: number, d: Difficulty, rnd: Rnd): Delivery {
  const cfg = DIFFICULTIES[d];
  const roll = rnd();
  let acc = 0;
  let type: DeliveryType = "normal";
  for (const t of ORDER) {
    acc += cfg.weights[t];
    if (roll < acc) {
      type = t;
      break;
    }
  }
  const delayMs = Math.round(RUN_UP_MS[0] + rnd() * RUN_UP_MS[1]);
  const dir = rnd() < 0.5 ? -1 : 1;
  const ramped = Math.max(cfg.speedMs * RAMP_FLOOR, cfg.speedMs - ballIndex * RAMP_MS_PER_BALL);
  const speedMs = Math.max(MIN_SPEED_MS, Math.round(ramped * SPEED_FACTOR[type]));
  return { type, delayMs, speedMs, swing: type === "swing" ? dir : 0 };
}
