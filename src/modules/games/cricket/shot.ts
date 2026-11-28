import { DIFFICULTIES, SHOT, SWEET_MS, type Difficulty, type Rnd } from "./config.ts";
import { classify, type Delivery, type Timing } from "./timing.ts";

export interface Shot {
  timing: Exclude<Timing, "miss">;
  offsetMs: number;
  /** Degrees from straight down the ground: negative = leg side (left), positive = off side (right). */
  angle: number;
  /** 0 to 1. */
  power: number;
  /** Lofted shot: can be caught, and clears the rope for six. */
  air: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Power for a swing `ms` away from perfect (already divided by the difficulty's window scale). */
export function powerAt(ms: number): number {
  const c = SHOT.powerCurve;
  const x = Math.abs(ms);
  for (let i = 1; i < c.length; i++) {
    const [x1, y1] = c[i]!;
    if (x <= x1) {
      const [x0, y0] = c[i - 1]!;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return c[c.length - 1]![1];
}

/**
 * Turns a swing into a shot, or null when the bat misses completely.
 * Early swings are driven along the ground to the leg side; late swings are lofted to the off side;
 * the sweet spot (a few ms either side of perfect) is lofted straight.
 * Power falls smoothly as the swing gets further from perfect. Dice order: direction jitter, power jitter. `aim` is the tap position from -1 (far left) to 1 (far right).
 */
export function makeShot(
  offsetMs: number,
  aim: number,
  delivery: Delivery,
  d: Difficulty,
  rnd: Rnd,
): Shot | null {
  const timing = classify(offsetMs, d);
  if (timing === "miss") return null;
  const jitterSize = timing === "poor" ? 10 : timing === "average" ? 6 : 3;
  const jitter = (rnd() * 2 - 1) * jitterSize;
  const powerJitter = (rnd() * 2 - 1) * 0.04;
  const sweet = Math.abs(offsetMs) <= SWEET_MS * DIFFICULTIES[d].windowScale;
  const angle = clamp(
    offsetMs * SHOT.degPerMs +
      clamp(aim, -1, 1) * SHOT.aimDeg +
      delivery.swing * SHOT.swingBiasDeg +
      jitter,
    -SHOT.maxAngle,
    SHOT.maxAngle,
  );
  return {
    timing,
    offsetMs,
    angle,
    power: clamp(powerAt(offsetMs / DIFFICULTIES[d].windowScale) + powerJitter, 0.1, 1),
    air: sweet || offsetMs > 0 || timing === "poor",
  };
}
