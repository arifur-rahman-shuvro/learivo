import { BALL_R, HEIGHT, PADDLE, PADDLE_Y, PHYSICS as P, WIDTH, type Player } from "./config.ts";

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Sideways curve: positive pushes the ball to the right. Dies away on its own. */
  spin: number;
  lastHitter: Player | null;
}
export interface Paddle {
  x: number;
  /** Sideways speed over the last few steps (units per second); it feeds spin and smashes. */
  vx: number;
  /** Where the finger or the AI wants the paddle to be. */
  target: number;
  maxSpeed: number;
}
export interface World {
  ball: Ball;
  paddles: [Paddle, Paddle];
}

export interface Hit {
  player: Player;
  offset: number;
  perfect: boolean;
  smash: boolean;
  speed: number;
}
export type StepEvent =
  | { type: "hit"; hit: Hit }
  | { type: "wall"; side: "left" | "right"; speed: number }
  /** The ball went past `loser`'s paddle and off the table. */
  | { type: "out"; loser: Player };

export const speedOf = (b: Pick<Ball, "vx" | "vy">) => Math.hypot(b.vx, b.vy);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function newWorld(): World {
  const mk = (): Paddle => ({ x: 0.5, vx: 0, target: 0.5, maxSpeed: PADDLE.maxSpeed });
  return {
    ball: { x: 0.5, y: HEIGHT / 2, vx: 0, vy: 0, spin: 0, lastHitter: null },
    paddles: [mk(), mk()],
  };
}

export const clampX = (x: number) => clamp(x, PADDLE.halfW, WIDTH - PADDLE.halfW);

/** Moves a paddle toward its target at no more than its top speed and keeps a smoothed velocity. */
export function movePaddle(p: Paddle, dt: number) {
  const want = clampX(p.target) - p.x;
  const maxMove = p.maxSpeed * dt;
  const move = clamp(want, -maxMove, maxMove);
  p.x += move;
  // A short running average, so one tiny step does not look like a smash.
  p.vx += (move / dt - p.vx) * 0.25;
}

/** Puts the ball on a paddle, ready to serve. */
export function placeForServe(w: World, server: Player) {
  const b = w.ball;
  b.x = w.paddles[server].x;
  b.y = server === 0 ? PADDLE_Y[0] - PADDLE.halfT - BALL_R : PADDLE_Y[1] + PADDLE.halfT + BALL_R;
  b.vx = 0;
  b.vy = 0;
  b.spin = 0;
  b.lastHitter = null;
}

/** Launches the ball from the server toward the receiver. `jitter` is -1 to 1 and sets a small angle. */
export function serve(w: World, server: Player, jitter: number, speedScale = 1) {
  const b = w.ball;
  const sp = P.serveSpeed * speedScale;
  const a = (jitter * 14 * Math.PI) / 180;
  b.vx = sp * Math.sin(a);
  b.vy = (server === 0 ? -1 : 1) * sp * Math.cos(a);
  b.spin = 0;
  b.lastHitter = server;
}

/**
 * How the ball leaves a paddle. Hitting off-centre sends it sideways, a moving paddle adds to that and
 * puts spin on the ball, the middle of the paddle gives a fast straight "perfect" return, and a fast
 * paddle gives a "smash". Pure: returns the new velocity and spin.
 */
export function returnShot(
  b: Pick<Ball, "x" | "vx" | "vy">,
  paddle: Pick<Paddle, "x" | "vx">,
  player: Player,
  speedScale = 1,
): { vx: number; vy: number; spin: number; hit: Hit } {
  const offset = clamp((b.x - paddle.x) / PADDLE.halfW, -1, 1);
  const perfect = Math.abs(offset) <= P.perfectZone;
  const smash = Math.abs(paddle.vx) >= P.smashSpeed;
  const push = clamp(paddle.vx / PADDLE.maxSpeed, -1, 1);
  const lim = P.maxAngle + P.velAngle;
  const angle = (clamp(offset * P.maxAngle + push * P.velAngle, -lim, lim) * Math.PI) / 180;
  const incoming = Math.hypot(b.vx, b.vy);
  let speed = (incoming + P.hitGain) * (perfect ? P.perfectBoost : 1) * (smash ? P.smashBoost : 1);
  speed = Math.min(P.maxSpeed * speedScale, speed);
  let vx = speed * Math.sin(angle);
  let vy = speed * Math.cos(angle);
  // Never flatter than the minimum, so the ball cannot crawl sideways along the table.
  const minVy = speed * P.minForward;
  if (vy < minVy) {
    vy = minVy;
    vx = Math.sign(vx || 1) * Math.sqrt(Math.max(0, speed * speed - vy * vy));
  }
  const spin = clamp(
    push * P.spinFromVelocity * 4 + offset * P.spinFromOffset,
    -P.maxSpin,
    P.maxSpin,
  );
  return {
    vx,
    vy: player === 0 ? -vy : vy,
    spin,
    hit: { player, offset, perfect, smash, speed },
  };
}

/** Where the paddle's playing face is, as the ball's centre meets it. */
export const faceY = (p: Player) =>
  p === 0 ? PADDLE_Y[0] - PADDLE.halfT - BALL_R : PADDLE_Y[1] + PADDLE.halfT + BALL_R;

/**
 * One fixed step of `dt` seconds. The ball is moved in a straight line and the paddle line it crosses is
 * checked on that exact line (continuous collision), so a fast ball can never jump over a paddle.
 * `wall` is the player whose side is a practice wall instead of a paddle (or null).
 */
export function step(
  w: World,
  dt: number,
  out: StepEvent[],
  speedScale = 1,
  wall: Player | null = null,
) {
  for (const p of w.paddles) movePaddle(p, dt);
  const b = w.ball;
  b.vx += b.spin * P.spinCurve * dt;
  b.spin *= Math.max(0, 1 - P.spinDecay * dt);

  const px = b.x;
  const py = b.y;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.x < BALL_R) {
    b.x = BALL_R + (BALL_R - b.x);
    b.vx = Math.abs(b.vx) * P.wallBounce;
    out.push({ type: "wall", side: "left", speed: speedOf(b) });
  } else if (b.x > WIDTH - BALL_R) {
    b.x = WIDTH - BALL_R - (b.x - (WIDTH - BALL_R));
    b.vx = -Math.abs(b.vx) * P.wallBounce;
    out.push({ type: "wall", side: "right", speed: speedOf(b) });
  }

  // Paddles: only the one the ball is flying toward, and only from the front.
  const who: Player = b.vy > 0 ? 0 : 1;
  if (who !== wall && b.lastHitter !== who) {
    const face = faceY(who);
    const crossed = who === 0 ? py <= face && b.y >= face : py >= face && b.y <= face;
    if (crossed) {
      const t = (face - py) / (b.y - py || 1);
      const cx = px + (b.x - px) * t;
      const pad = w.paddles[who];
      if (Math.abs(cx - pad.x) <= PADDLE.halfW + BALL_R * 0.6) {
        const r = returnShot({ x: cx, vx: b.vx, vy: b.vy }, pad, who, speedScale);
        b.x = cx;
        b.y = face;
        b.vx = r.vx;
        b.vy = r.vy;
        b.spin = r.spin;
        b.lastHitter = who;
        out.push({ type: "hit", hit: r.hit });
        return;
      }
    }
  }

  // A practice wall sends every ball back.
  if (wall !== null && b.vy < 0 && wall === 1 && b.y <= faceY(1)) {
    b.y = faceY(1);
    b.vy = Math.abs(b.vy);
    b.spin *= 0.5;
    b.lastHitter = 1;
    out.push({
      type: "hit",
      hit: { player: 1, offset: 0, perfect: false, smash: false, speed: speedOf(b) },
    });
    return;
  }

  if (b.y > HEIGHT + BALL_R * 2) out.push({ type: "out", loser: 0 });
  else if (b.y < -BALL_R * 2) out.push({ type: "out", loser: 1 });
}
