import {
  BALL_R,
  PADDLE,
  PADDLE_Y,
  PHYSICS as P,
  WIDTH,
  type AiCfg,
  type Player,
  type Rnd,
} from "./config.ts";
import { clampX, type World } from "./physics.ts";

interface Seen {
  t: number;
  x: number;
  y: number;
}

/** Box-Muller: a normally distributed number from two dice. */
function gauss(rnd: Rnd) {
  return Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
}

/** Folds an x position that has flown through the side walls back onto the table. */
export function unfold(x: number): number {
  const lo = BALL_R;
  const span = WIDTH - 2 * BALL_R;
  let u = (x - lo) % (2 * span);
  if (u < 0) u += 2 * span;
  return lo + (u > span ? 2 * span - u : u);
}

/**
 * A computer player that plays like a person: it only sees the ball as it was a moment ago, works out
 * the ball's speed from what it saw, predicts where the ball will arrive (allowing for the walls),
 * aims a little off by a random amount, sometimes misjudges a ball badly, and tries to hit away from
 * its opponent. Higher levels differ in all of these, not in ball speed.
 */
export class AiPlayer {
  private seen: Seen[] = [];
  private approaching = false;
  private err = 0;

  constructor(
    readonly cfg: AiCfg,
    readonly player: Player,
    private readonly rnd: Rnd,
  ) {}

  /** The paddle's top speed for this player. */
  get speed() {
    return this.cfg.speed;
  }

  reset() {
    this.seen = [];
    this.approaching = false;
    this.err = 0;
  }

  /** `t` is the match clock in seconds. Returns the x the paddle should head for. */
  update(t: number, w: World, opponentX: number): number {
    const b = w.ball;
    this.seen.push({ t, x: b.x, y: b.y });
    while (this.seen.length > 2 && this.seen[1]!.t < t - this.cfg.reaction - 0.2) this.seen.shift();

    // What the AI sees now is the ball as it was `reaction` seconds ago.
    const cutoff = t - this.cfg.reaction;
    let a = this.seen[0]!;
    for (const s of this.seen) if (s.t <= cutoff) a = s;
    let prev = this.seen[0]!;
    for (const s of this.seen) if (s.t <= a.t - 0.04) prev = s;
    const dt = a.t - prev.t;
    if (dt <= 0) return 0.5;
    let vx = (a.x - prev.x) / dt;
    const vy = (a.y - prev.y) / dt;

    const toward = this.player === 0 ? vy > 0.05 : vy < -0.05;
    if (!toward) {
      this.approaching = false;
      return 0.5; // back to the middle
    }
    const speed = Math.hypot(vx, vy);
    if (!this.approaching) {
      // A new ball is coming: decide how well this one will be read.
      this.approaching = true;
      this.err = gauss(this.rnd) * this.cfg.error * (0.6 + speed / P.maxSpeed);
      if (this.rnd() < this.cfg.mistake) {
        this.err += (this.rnd() < 0.5 ? -1 : 1) * (0.2 + this.rnd() * 0.15);
      }
    }
    const face =
      this.player === 0 ? PADDLE_Y[0] - PADDLE.halfT - BALL_R : PADDLE_Y[1] + PADDLE.halfT + BALL_R;
    const tHit = Math.max(0, (face - a.y) / vy);
    // A strong player allows for the curve of a spinning ball.
    if (this.cfg.prediction >= 1) vx += b.spin * P.spinCurve * tHit * 0.5;
    const raw = a.x + vx * tHit;
    const landing = this.cfg.prediction >= 0.75 ? unfold(raw) : Math.min(WIDTH, Math.max(0, raw));
    // Where on the paddle to meet the ball: away from the opponent.
    const away = opponentX < 0.5 ? 1 : -1;
    const want = this.cfg.placement * 0.65 * away;
    return clampX(landing - want * PADDLE.halfW + this.err);
  }
}
