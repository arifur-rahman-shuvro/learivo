import { describe, expect, it } from "vitest";
import { AiPlayer, unfold } from "./ai.ts";
import { BALL_R, LEVELS, PADDLE, PHYSICS as P, type AiCfg } from "./config.ts";
import { faceY, newWorld, type World } from "./physics.ts";

/** An AI with no errors and no mistakes, so the maths can be checked exactly. */
const exact: AiCfg = {
  ...LEVELS.expert,
  reaction: 0,
  error: 0,
  mistake: 0,
  placement: 0,
  prediction: 1,
};
const calm = () => 0.5;

function feed(ai: AiPlayer, w: World, from: number, to: number, opp = 0.5) {
  // runs the ball in a straight line for a while and returns the last answer
  let out = 0.5;
  for (let t = from; t <= to; t += 1 / 60) {
    const k = t - from;
    w.ball.x += w.ball.vx / 60;
    w.ball.y += w.ball.vy / 60;
    void k;
    out = ai.update(t, w, opp);
  }
  return out;
}
const ball = (w: World, x: number, y: number, vx: number, vy: number) =>
  Object.assign(w.ball, { x, y, vx, vy, spin: 0 });

describe("folding the walls", () => {
  it("leaves an x on the table alone and bounces one that flew out", () => {
    expect(unfold(0.4)).toBeCloseTo(0.4, 9);
    expect(unfold(1 + 0.1)).toBeCloseTo(1 - BALL_R * 2 - 0.1 + 0, 6);
    expect(unfold(-0.1)).toBeCloseTo(BALL_R * 2 + 0.1, 6);
    // all the way across and back again lands where it started
    const span = 1 - 2 * BALL_R;
    expect(unfold(BALL_R + 2 * span + 0.2)).toBeCloseTo(BALL_R + 0.2, 6);
  });
});

describe("the computer player", () => {
  it("goes back to the middle while the ball is going away", () => {
    const w = newWorld();
    ball(w, 0.2, 0.8, 0, 1.5); // moving down, away from the top player
    const ai = new AiPlayer(exact, 1, calm);
    expect(feed(ai, w, 0, 0.2)).toBe(0.5);
  });
  it("heads for where a straight ball will arrive", () => {
    const w = newWorld();
    ball(w, 0.7, 0.9, 0, -1.5);
    const ai = new AiPlayer(exact, 1, calm);
    expect(feed(ai, w, 0, 0.1)).toBeCloseTo(0.7, 2);
  });
  it("works out the angle of the ball from what it has seen", () => {
    const w = newWorld();
    ball(w, 0.4, 1.0, 0.4, -1.4);
    const ai = new AiPlayer(exact, 1, calm);
    const expected = 0.4 + (0.4 * (1.0 - faceY(1))) / 1.4;
    expect(feed(ai, w, 0, 0.15)).toBeCloseTo(expected, 1);
  });
  it("allows for a bounce off the side wall (when it can predict)", () => {
    const w = newWorld();
    ball(w, 0.8, 1.0, 1.0, -1.2);
    const exactAi = new AiPlayer(exact, 1, calm);
    const target = feed(exactAi, w, 0, 0.1);
    const raw = 0.8 + (1.0 * (1.0 - faceY(1))) / 1.2;
    expect(raw).toBeGreaterThan(1); // it really goes off the table without the wall
    expect(target).toBeCloseTo(unfold(raw), 1);
    expect(target).toBeLessThan(1);
    // the easy player does not fold the walls
    const w2 = newWorld();
    ball(w2, 0.8, 1.0, 1.0, -1.2);
    const easy = new AiPlayer({ ...exact, prediction: 0.5 }, 1, calm);
    expect(feed(easy, w2, 0, 0.1)).toBeCloseTo(1 - PADDLE.halfW, 1); // clamped to the edge, nowhere near
  });
  it("cannot react to a ball it has not seen yet: the reaction delay", () => {
    const slow = new AiPlayer({ ...exact, reaction: 0.3 }, 1, calm);
    const fast = new AiPlayer({ ...exact, reaction: 0 }, 1, calm);
    const w1 = newWorld();
    const w2 = newWorld();
    ball(w1, 0.8, 1.2, 0, 0);
    ball(w2, 0.8, 1.2, 0, 0);
    slow.update(0, w1, 0.5);
    fast.update(0, w2, 0.5);
    for (const w of [w1, w2]) Object.assign(w.ball, { vx: 0, vy: -1.5 });
    let tSlow = -1;
    let tFast = -1;
    for (let t = 1 / 60; t < 1; t += 1 / 60) {
      for (const w of [w1, w2]) w.ball.y += w.ball.vy / 60;
      const a = slow.update(t, w1, 0.5);
      const b = fast.update(t, w2, 0.5);
      if (tSlow < 0 && Math.abs(a - 0.5) > 0.0001) tSlow = t;
      if (tFast < 0 && Math.abs(b - 0.5) > 0.0001) tFast = t;
      w1.ball.x = w2.ball.x = 0.8;
    }
    expect(tFast).toBeGreaterThan(0);
    // both react to the same ball; the slow one is later by about its reaction time
    expect(tSlow - tFast).toBeGreaterThan(0.2);
    expect(tSlow - tFast).toBeLessThan(0.45);
  });
  it("a bad misjudgement (the 'mistake' dice) sends the paddle well away from the ball", () => {
    const w = newWorld();
    ball(w, 0.5, 1.0, 0, -1.5);
    const sure = new AiPlayer({ ...exact, mistake: 1 }, 1, () => 0.6);
    const off = Math.abs(feed(sure, w, 0, 0.1) - 0.5);
    expect(off).toBeGreaterThan(PADDLE.halfW + 0.05); // too far to reach it
  });
  it("tries to hit the ball away from its opponent (placement)", () => {
    const mk = () => {
      const w = newWorld();
      ball(w, 0.5, 1.0, 0, -1.5);
      return w;
    };
    const cfg = { ...exact, placement: 1 };
    const opponentLeft = feed(new AiPlayer(cfg, 1, calm), mk(), 0, 0.1, 0.2);
    const opponentRight = feed(new AiPlayer(cfg, 1, calm), mk(), 0, 0.1, 0.8);
    // paddle left of the ball sends it to the right, away from a player on the left
    expect(opponentLeft).toBeLessThan(0.5);
    expect(opponentRight).toBeGreaterThan(0.5);
    const none = feed(new AiPlayer({ ...exact, placement: 0 }, 1, calm), mk(), 0, 0.1, 0.2);
    expect(none).toBeCloseTo(0.5, 2);
  });
  it("the bottom player can be a computer too", () => {
    const w = newWorld();
    ball(w, 0.3, 0.6, 0, 1.5);
    const ai = new AiPlayer(exact, 0, calm);
    expect(feed(ai, w, 0, 0.1)).toBeCloseTo(0.3, 2);
  });
  it("higher levels react faster, move faster, aim better and slip up less", () => {
    const order = ["easy", "normal", "hard", "expert"] as const;
    for (let i = 1; i < order.length; i++) {
      const lo = LEVELS[order[i - 1]!];
      const hi = LEVELS[order[i]!];
      expect(hi.reaction).toBeLessThan(lo.reaction);
      expect(hi.speed).toBeGreaterThan(lo.speed);
      expect(hi.error).toBeLessThan(lo.error);
      expect(hi.mistake).toBeLessThan(lo.mistake);
      expect(hi.placement).toBeGreaterThanOrEqual(lo.placement);
      expect(hi.prediction).toBeGreaterThanOrEqual(lo.prediction);
    }
    // difficulty is never "just a faster ball": the physics has no per-level number at all
    expect(Object.keys(LEVELS.easy)).not.toContain("ballSpeed");
    expect(P.maxSpeed).toBeGreaterThan(0);
  });
});
