import { describe, expect, it } from "vitest";
import { BALL_R, HEIGHT, PADDLE, PADDLE_Y, PHYSICS as P, WIDTH } from "./config.ts";
import {
  clampX,
  faceY,
  movePaddle,
  newWorld,
  placeForServe,
  returnShot,
  serve,
  speedOf,
  step,
  type StepEvent,
  type World,
} from "./physics.ts";

const DT = P.step;
/** A world with the ball placed and the paddles waiting at x. */
function world(ball: Partial<World["ball"]>, p0 = 0.5, p1 = 0.5): World {
  const w = newWorld();
  Object.assign(w.ball, { x: 0.5, y: 0.8, vx: 0, vy: 0, spin: 0 }, ball);
  w.paddles[0].x = w.paddles[0].target = p0;
  w.paddles[1].x = w.paddles[1].target = p1;
  return w;
}
function run(w: World, seconds: number, wall: 0 | 1 | null = null) {
  const out: StepEvent[] = [];
  for (let i = 0; i < seconds / DT; i++) {
    step(w, DT, out, 1, wall);
    if (out.some((e) => e.type === "out")) break;
  }
  return out;
}
const still = { x: 0.5, vx: 0 };

describe("how the ball leaves a paddle", () => {
  it("the middle of the paddle is a perfect hit: straight and a little faster", () => {
    const r = returnShot({ x: 0.5, vx: 0, vy: 1.2 }, { ...still }, 0);
    expect(r.hit.perfect).toBe(true);
    expect(r.hit.smash).toBe(false);
    expect(r.vx).toBeCloseTo(0, 6);
    expect(r.vy).toBeLessThan(0); // player 0 hits up the table
    expect(Math.abs(r.vy)).toBeCloseTo((1.2 + P.hitGain) * P.perfectBoost, 6);
  });
  it("player 1 hits down the table", () => {
    expect(returnShot({ x: 0.5, vx: 0, vy: -1.2 }, { ...still }, 1).vy).toBeGreaterThan(0);
  });
  it("hitting right of centre sends the ball right, left of centre sends it left, and more offset means more angle", () => {
    const at = (dx: number) => returnShot({ x: 0.5 + dx, vx: 0, vy: 1 }, { ...still }, 0);
    expect(at(0.06).vx).toBeGreaterThan(0);
    expect(at(-0.06).vx).toBeLessThan(0);
    expect(at(0.1).vx).toBeGreaterThan(at(0.06).vx);
    expect(at(0.06).vx).toBeCloseTo(-at(-0.06).vx, 6);
    expect(at(0.1).hit.perfect).toBe(false);
    expect(at(0.1).hit.offset).toBeCloseTo(0.1 / PADDLE.halfW, 6);
    // the outermost angle is the limit
    const edge = at(PADDLE.halfW);
    const deg = (Math.atan2(edge.vx, -edge.vy) * 180) / Math.PI;
    expect(deg).toBeCloseTo(P.maxAngle, 3);
  });
  it("a moving paddle adds angle and spin, and a fast one smashes", () => {
    const slow = returnShot({ x: 0.5, vx: 0, vy: 1 }, { x: 0.5, vx: 0 }, 0);
    const moving = returnShot({ x: 0.5, vx: 0, vy: 1 }, { x: 0.5, vx: 1 }, 0);
    expect(moving.vx).toBeGreaterThan(slow.vx);
    expect(moving.spin).toBeGreaterThan(0);
    expect(moving.hit.smash).toBe(false);
    const fast = returnShot({ x: 0.5, vx: 0, vy: 1 }, { x: 0.5, vx: P.smashSpeed }, 0);
    expect(fast.hit.smash).toBe(true);
    expect(fast.hit.speed).toBeCloseTo((1 + P.hitGain) * P.perfectBoost * P.smashBoost, 6);
    expect(returnShot({ x: 0.5, vx: 0, vy: 1 }, { x: 0.5, vx: -P.smashSpeed }, 0).hit.smash).toBe(
      true,
    );
    expect(returnShot({ x: 0.5, vx: 0, vy: 1 }, { x: 0.5, vx: -1 }, 0).spin).toBeLessThan(0);
  });
  it("the ball speeds up with every hit but never past the top speed", () => {
    let v = 1;
    const speeds: number[] = [];
    for (let i = 0; i < 80; i++) {
      v = returnShot({ x: 0.5, vx: 0, vy: v }, { x: 0.5, vx: 0 }, 0).hit.speed;
      speeds.push(v);
    }
    expect(speeds[1]!).toBeGreaterThan(speeds[0]!);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(P.maxSpeed + 1e-9);
    expect(speeds.at(-1)).toBeCloseTo(P.maxSpeed, 6);
  });
  it("the ball never leaves flatter than the minimum forward share", () => {
    for (const dx of [-0.12, -0.08, 0, 0.08, 0.12]) {
      for (const vx of [-2, 0, 2]) {
        const r = returnShot({ x: 0.5 + dx, vx: 0, vy: 1.5 }, { x: 0.5, vx }, 0);
        expect(Math.abs(r.vy) / Math.hypot(r.vx, r.vy)).toBeGreaterThanOrEqual(P.minForward - 1e-9);
      }
    }
  });
  it("a slower speed limit (practice) caps the return", () => {
    expect(returnShot({ x: 0.5, vx: 0, vy: 5 }, { ...still }, 0, 0.75).hit.speed).toBeCloseTo(
      P.maxSpeed * 0.75,
      6,
    );
  });
});

describe("the ball on the table", () => {
  it("bounces off the side walls and says so", () => {
    const w = world({ x: 0.1, y: 0.8, vx: -2, vy: 0 });
    const out = run(w, 0.1);
    expect(out.some((e) => e.type === "wall" && e.side === "left")).toBe(true);
    expect(w.ball.vx).toBeGreaterThan(0);
    const r = world({ x: 0.9, y: 0.8, vx: 2, vy: 0 });
    expect(run(r, 0.1).some((e) => e.type === "wall" && e.side === "right")).toBe(true);
    expect(r.ball.vx).toBeLessThan(0);
  });
  it("never leaves the side walls", () => {
    const w = world({ x: 0.5, y: 0.8, vx: 3, vy: 0.2 });
    for (let i = 0; i < 2000; i++) {
      step(w, DT, []);
      expect(w.ball.x).toBeGreaterThanOrEqual(BALL_R - 1e-9);
      expect(w.ball.x).toBeLessThanOrEqual(WIDTH - BALL_R + 1e-9);
      w.ball.y = 0.8; // keep it in play
    }
  });
  it("the bottom paddle returns a ball that arrives on it", () => {
    const w = world({ x: 0.5, y: 1.2, vx: 0, vy: 1.5, lastHitter: 1 });
    const out: StepEvent[] = [];
    for (let i = 0; i < 200 && out.length === 0; i++) step(w, DT, out);
    expect(out[0]?.type).toBe("hit");
    expect(w.ball.y).toBeCloseTo(faceY(0), 6);
    expect(w.ball.vy).toBeLessThan(0);
    expect(w.ball.lastHitter).toBe(0);
  });
  it("the top paddle returns a ball that arrives on it", () => {
    const w = world({ x: 0.5, y: 0.4, vx: 0, vy: -1.5, lastHitter: 0 });
    const out = run(w, 1);
    expect(out.some((e) => e.type === "hit" && e.hit.player === 1)).toBe(true);
    expect(w.ball.vy).toBeGreaterThan(0);
  });
  it("a ball that misses the paddle goes off the table and that player loses the point", () => {
    const w = world({ x: 0.1, y: 1.2, vx: 0, vy: 1.5, lastHitter: 1 }, 0.8);
    const out = run(w, 2);
    expect(out.some((e) => e.type === "hit")).toBe(false);
    expect(out.at(-1)).toEqual({ type: "out", loser: 0 });
    const t = world({ x: 0.1, y: 0.4, vx: 0, vy: -1.5, lastHitter: 0 }, 0.5, 0.8);
    expect(run(t, 2).at(-1)).toEqual({ type: "out", loser: 1 });
  });
  it("the paddle edge counts: just inside hits, clearly outside misses", () => {
    const inside = world({ x: 0.5 + PADDLE.halfW - 0.002, y: 1.2, vy: 1.5, lastHitter: 1 });
    expect(run(inside, 1).some((e) => e.type === "hit")).toBe(true);
    const outside = world({
      x: 0.5 + PADDLE.halfW + BALL_R + 0.02,
      y: 1.2,
      vy: 1.5,
      lastHitter: 1,
    });
    expect(run(outside, 1).some((e) => e.type === "hit")).toBe(false);
  });
  it("a ball cannot hit the same paddle twice in a row", () => {
    const w = world({ x: 0.5, y: 1.4, vy: 1.5, lastHitter: 1 });
    const out = run(w, 0.4);
    expect(out.filter((e) => e.type === "hit")).toHaveLength(1);
  });
  it("never tunnels through a paddle, even when it is very fast", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    let tested = 0;
    for (let i = 0; i < 2000 && tested < 400; i++) {
      const px = 0.2 + rnd() * 0.6;
      const xc = px + (rnd() - 0.5) * 2 * PADDLE.halfW * 0.9; // where the ball meets the paddle line
      const y0 = 1.1 + rnd() * 0.3;
      const vy = 1 + rnd() * 9; // up to 9 units per second: 0.075 per step
      const vx = (rnd() - 0.5) * 1.5;
      const x0 = xc - (vx * (faceY(0) - y0)) / vy;
      if (x0 < 0.06 || x0 > 0.94) continue; // would bounce off a wall first
      tested++;
      const w = world({ x: x0, y: y0, vx, vy, lastHitter: 1 }, px);
      const out = run(w, 1.5);
      const first = out.find((e) => e.type === "hit" || e.type === "out");
      expect(first?.type, `case ${i}`).toBe("hit");
    }
    expect(tested).toBe(400);
  });
  it("spin curves the flight and fades away", () => {
    const straight = world({ x: 0.5, y: 0.8, vx: 0, vy: -1 });
    const spun = world({ x: 0.5, y: 0.8, vx: 0, vy: -1, spin: 1 });
    for (let i = 0; i < 60; i++) {
      step(straight, DT, []);
      step(spun, DT, []);
    }
    expect(spun.ball.x).toBeGreaterThan(straight.ball.x + 0.01);
    expect(spun.ball.spin).toBeLessThan(1);
    expect(spun.ball.spin).toBeGreaterThan(0);
  });
  it("is the same on every run (deterministic)", () => {
    const a = world({ x: 0.3, y: 1.1, vx: 0.7, vy: 1.4, spin: 0.4, lastHitter: 1 });
    const b = world({ x: 0.3, y: 1.1, vx: 0.7, vy: 1.4, spin: 0.4, lastHitter: 1 });
    run(a, 1);
    run(b, 1);
    expect(a.ball).toEqual(b.ball);
  });
});

describe("paddles", () => {
  it("follow the target but never faster than their top speed", () => {
    const w = world({});
    w.paddles[0].target = 0.9;
    movePaddle(w.paddles[0], 0.1);
    expect(w.paddles[0].x).toBeCloseTo(0.5 + PADDLE.maxSpeed * 0.1, 6);
    w.paddles[1].maxSpeed = 1;
    w.paddles[1].target = 0.2;
    movePaddle(w.paddles[1], 0.1);
    expect(w.paddles[1].x).toBeCloseTo(0.4, 6);
  });
  it("stay on the table", () => {
    const w = world({});
    w.paddles[0].target = 5;
    for (let i = 0; i < 400; i++) movePaddle(w.paddles[0], DT);
    expect(w.paddles[0].x).toBeCloseTo(1 - PADDLE.halfW, 6);
    expect(clampX(-3)).toBe(PADDLE.halfW);
  });
  it("report how fast they are moving, and stop reporting it when they stop", () => {
    const w = world({});
    w.paddles[0].target = 0.9;
    for (let i = 0; i < 8; i++) movePaddle(w.paddles[0], DT);
    expect(w.paddles[0].vx).toBeGreaterThan(P.smashSpeed);
    w.paddles[0].target = w.paddles[0].x;
    for (let i = 0; i < 80; i++) movePaddle(w.paddles[0], DT);
    expect(Math.abs(w.paddles[0].vx)).toBeLessThan(0.01);
  });
});

describe("serving", () => {
  it("places the ball on the server's paddle and sends it toward the other player", () => {
    const w = world({}, 0.3, 0.7);
    placeForServe(w, 0);
    expect(w.ball.x).toBeCloseTo(0.3, 9);
    expect(w.ball.y).toBeCloseTo(PADDLE_Y[0] - PADDLE.halfT - BALL_R, 9);
    serve(w, 0, 0);
    expect(w.ball.vy).toBeCloseTo(-P.serveSpeed, 9);
    expect(w.ball.lastHitter).toBe(0);
    placeForServe(w, 1);
    serve(w, 1, 0);
    expect(w.ball.vy).toBeCloseTo(P.serveSpeed, 9);
    expect(w.ball.y).toBeLessThan(HEIGHT / 2);
  });
  it("a serve with a sideways jitter goes sideways but is never faster than the serve speed", () => {
    const w = world({});
    placeForServe(w, 0);
    serve(w, 0, 1);
    expect(w.ball.vx).toBeGreaterThan(0);
    expect(speedOf(w.ball)).toBeCloseTo(P.serveSpeed, 9);
  });
  it("a served ball reaches the other paddle and is returned", () => {
    const w = world({}, 0.5, 0.5);
    placeForServe(w, 0);
    serve(w, 0, 0);
    const out = run(w, 3);
    expect(out.some((e) => e.type === "hit" && e.hit.player === 1)).toBe(true);
  });
});

describe("the practice wall", () => {
  it("sends every ball back, with the player's own paddle in play", () => {
    const w = world({ x: 0.5, y: 0.5, vy: -1.5, lastHitter: 0 });
    const out = run(w, 1, 1);
    expect(out.some((e) => e.type === "hit" && e.hit.player === 1)).toBe(true);
    expect(w.ball.vy).toBeGreaterThan(0);
  });
});
