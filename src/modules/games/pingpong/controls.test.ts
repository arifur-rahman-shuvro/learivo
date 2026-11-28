import { describe, expect, it } from "vitest";
import { PADDLE } from "./config.ts";
import { Touches } from "./controls.ts";

describe("two players on one screen", () => {
  it("the lower half drives player 0 and the upper half drives player 1", () => {
    const t = new Touches("split");
    expect(t.down(1, 0.5, 0.8)?.player).toBe(0);
    expect(t.down(2, 0.5, 0.2)?.player).toBe(1);
    expect(t.active).toBe(2);
  });
  it("both fingers move their own paddle at the same time", () => {
    const t = new Touches("split");
    t.sensitivity = 1;
    t.down(1, 0.3, 0.9);
    t.down(2, 0.7, 0.1);
    expect(t.move(1, 0.35)).toEqual({ player: 0, x: 0.35 });
    expect(t.move(2, 0.65)).toEqual({ player: 1, x: 0.65 });
    expect(t.move(1, 0.4)?.player).toBe(0);
  });
  it("a finger that wanders across the middle keeps its own paddle", () => {
    const t = new Touches("split");
    t.down(1, 0.5, 0.9);
    // the screen y is not even passed on a move: ownership was fixed on touch down
    expect(t.move(1, 0.5)?.player).toBe(0);
    expect(t.down(2, 0.5, 0.2)?.player).toBe(1);
    expect(t.move(1, 0.2)?.player).toBe(0);
    expect(t.move(2, 0.8)?.player).toBe(1);
  });
  it("a second finger on a half that already has one is ignored", () => {
    const t = new Touches("split");
    expect(t.down(1, 0.2, 0.9)).not.toBeNull();
    expect(t.down(2, 0.8, 0.7)).toBeNull();
    expect(t.move(2, 0.5)).toBeNull();
    expect(t.active).toBe(1);
  });
  it("lifting a finger frees the paddle for a new one", () => {
    const t = new Touches("split");
    t.down(1, 0.2, 0.9);
    expect(t.up(1)).toBe(0);
    expect(t.move(1, 0.3)).toBeNull();
    expect(t.down(3, 0.6, 0.9)?.player).toBe(0);
  });
  it("lifting or cancelling an unknown finger does nothing, and the same finger cannot land twice", () => {
    const t = new Touches("split");
    expect(t.up(9)).toBeNull();
    t.down(1, 0.5, 0.9);
    expect(t.down(1, 0.5, 0.2)).toBeNull();
    expect(t.active).toBe(1);
  });
  it("clear forgets everything (pause, focus lost, resize)", () => {
    const t = new Touches("split");
    t.down(1, 0.5, 0.9);
    t.down(2, 0.5, 0.1);
    t.clear();
    expect(t.active).toBe(0);
    expect(t.move(1, 0.5)).toBeNull();
    expect(t.down(5, 0.5, 0.9)?.player).toBe(0);
  });
});

describe("one player", () => {
  it("every finger drives player 0, one at a time", () => {
    const t = new Touches("single");
    expect(t.down(1, 0.5, 0.1)?.player).toBe(0);
    expect(t.down(2, 0.5, 0.9)).toBeNull();
  });
});

describe("where the paddle goes", () => {
  it("follows the finger across the table and stays on it", () => {
    const t = new Touches("single");
    t.sensitivity = 1;
    expect(t.aim(0.5)).toBe(0.5);
    expect(t.aim(0.6)).toBeCloseTo(0.6, 9);
    expect(t.aim(-1)).toBe(PADDLE.halfW);
    expect(t.aim(2)).toBe(1 - PADDLE.halfW);
  });
  it("a higher sensitivity lets a short drag cover more of the table", () => {
    const t = new Touches("single");
    t.sensitivity = 1;
    const base = t.aim(0.6) - 0.5;
    t.sensitivity = 1.5;
    expect(t.aim(0.6) - 0.5).toBeCloseTo(base * 1.5, 9);
    t.sensitivity = 0.7;
    expect(t.aim(0.6) - 0.5).toBeCloseTo(base * 0.7, 9);
  });
});
