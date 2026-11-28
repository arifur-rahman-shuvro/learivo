import { describe, expect, it } from "vitest";
import { BATSMAN, DIFFICULTIES, MIN_SPEED_MS, MODES, type Difficulty } from "./config.ts";
import {
  describe as describeOutcome,
  fieldersFor,
  missOutcome,
  resolveShot,
  ropeDist,
  rollDistAt,
} from "./fielding.ts";
import {
  applyOutcome,
  chaseVerdict,
  chaseWon,
  emptyTally,
  isOver,
  overs,
  targetFor,
  verdict,
} from "./match.ts";
import { makeShot, powerAt, type Shot } from "./shot.ts";
import { classify, missWindowMs, newDelivery, type Delivery } from "./timing.ts";

const half = () => 0.5;
const zero = () => 0;
const never = () => 0.999;
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)]!;
};
const normal: Delivery = { type: "normal", delayMs: 800, speedMs: 1300, swing: 0 };
const shotAt = (off: number, d: Difficulty = "medium", aim = 0) =>
  makeShot(off, aim, normal, d, half)!;

describe("timing windows", () => {
  it("uses the brief's thresholds at medium, on both sides and at the exact edge", () => {
    for (const sign of [1, -1]) {
      expect(classify(sign * 80, "medium")).toBe("perfect");
      expect(classify(sign * 81, "medium")).toBe("good");
      expect(classify(sign * 160, "medium")).toBe("good");
      expect(classify(sign * 161, "medium")).toBe("average");
      expect(classify(sign * 250, "medium")).toBe("average");
      expect(classify(sign * 251, "medium")).toBe("poor");
      expect(classify(sign * 380, "medium")).toBe("poor");
      expect(classify(sign * 381, "medium")).toBe("miss");
    }
  });
  it("is wider on easy and tighter on hard", () => {
    expect(classify(100, "easy")).toBe("perfect"); // 80 x 1.3 = 104
    expect(classify(105, "easy")).toBe("good");
    expect(classify(64, "hard")).toBe("perfect"); // 80 x 0.8 = 64
    expect(classify(65, "hard")).toBe("good");
    expect(missWindowMs("easy")).toBeGreaterThan(missWindowMs("medium"));
    expect(missWindowMs("hard")).toBeLessThan(missWindowMs("medium"));
  });
});

describe("deliveries", () => {
  it("picks the type from the weights and never swings on easy", () => {
    expect(newDelivery(0, "medium", zero).type).toBe("normal");
    expect(newDelivery(0, "medium", never).type).toBe("swing");
    expect(newDelivery(0, "easy", never).type).not.toBe("swing");
    expect(newDelivery(0, "medium", seq(0.7)).type).toBe("fast"); // 0.45 + 0.2 = 0.65 <= 0.7 < 0.85
    expect(newDelivery(0, "medium", seq(0.5)).type).toBe("slow");
  });
  it("fast is quicker and slow is slower than normal", () => {
    const normalMs = newDelivery(0, "medium", zero).speedMs;
    const fast = newDelivery(0, "medium", seq(0.7)).speedMs;
    const slow = newDelivery(0, "medium", seq(0.5)).speedMs;
    expect(fast).toBeLessThan(normalMs);
    expect(slow).toBeGreaterThan(normalMs);
    expect(normalMs).toBe(DIFFICULTIES.medium.speedMs);
  });
  it("swing curves one way or the other, other types do not curve", () => {
    expect(newDelivery(0, "medium", seq(0.999, 0, 0)).swing).toBe(-1);
    expect(newDelivery(0, "medium", seq(0.999, 0, 0.9)).swing).toBe(1);
    expect(newDelivery(0, "medium", zero).swing).toBe(0);
  });
  it("gets quicker with each ball faced but never below the floor", () => {
    const a = newDelivery(0, "medium", zero).speedMs;
    const b = newDelivery(10, "medium", zero).speedMs;
    expect(b).toBeLessThan(a);
    expect(newDelivery(500, "medium", zero).speedMs).toBe(Math.round(1300 * 0.72));
    expect(newDelivery(500, "hard", seq(0.7)).speedMs).toBeGreaterThanOrEqual(MIN_SPEED_MS);
  });
  it("run-up is 700 to 1300 ms", () => {
    expect(newDelivery(0, "medium", zero).delayMs).toBe(700);
    expect(newDelivery(0, "medium", never).delayMs).toBe(1299);
  });
});

describe("shots", () => {
  it("a swing more than the miss window away is no shot at all", () => {
    expect(makeShot(381, 0, normal, "medium", half)).toBeNull();
    expect(makeShot(-381, 0, normal, "medium", half)).toBeNull();
    expect(makeShot(380, 0, normal, "medium", half)).not.toBeNull();
  });
  it("early goes left (leg side) along the ground, late goes right (off side) and high", () => {
    const early = shotAt(-100);
    const late = shotAt(100);
    expect(early.angle).toBeLessThan(0);
    expect(early.air).toBe(false);
    expect(late.angle).toBeGreaterThan(0);
    expect(late.air).toBe(true);
  });
  it("the sweet spot goes straight and high", () => {
    for (const off of [-30, 0, 30]) {
      const s = shotAt(off);
      expect(s.air).toBe(true);
      expect(Math.abs(s.angle)).toBeLessThan(8);
    }
    expect(shotAt(-31).air).toBe(false);
  });
  it("a poor swing is always a high mis-hit", () => {
    expect(shotAt(-300).air).toBe(true);
    expect(shotAt(-300).timing).toBe("poor");
  });
  it("tapping to one side steers the ball and swing bends it", () => {
    expect(makeShot(0, 1, normal, "medium", half)!.angle).toBeGreaterThan(10);
    expect(makeShot(0, -1, normal, "medium", half)!.angle).toBeLessThan(-10);
    expect(makeShot(0, 5, normal, "medium", half)!.angle).toBe(
      makeShot(0, 1, normal, "medium", half)!.angle,
    );
    const sw = { ...normal, type: "swing", swing: 1 } as Delivery;
    expect(makeShot(0, 0, sw, "medium", half)!.angle).toBeGreaterThan(
      makeShot(0, 0, normal, "medium", half)!.angle,
    );
  });
  it("power only ever falls as the swing gets further from perfect", () => {
    let last = 2;
    for (let ms = 0; ms <= 380; ms += 5) {
      const p = powerAt(ms);
      expect(p).toBeLessThanOrEqual(last);
      last = p;
    }
    expect(powerAt(0)).toBe(1);
    expect(powerAt(-80)).toBeCloseTo(0.86);
    expect(powerAt(380)).toBeCloseTo(0.2);
  });
  it("the angle is limited and the dice only jitter it a little", () => {
    expect(Math.abs(makeShot(380, 1, normal, "medium", half)!.angle)).toBeLessThanOrEqual(65);
    const a = makeShot(0, 0, normal, "medium", zero)!.angle;
    const b = makeShot(0, 0, normal, "medium", never)!.angle;
    expect(Math.abs(a - b)).toBeLessThan(7);
  });
});

describe("the ground", () => {
  it("the rope is a circle: straight up is far, sideways is near", () => {
    expect(ropeDist(BATSMAN, { x: 0, y: -1 })).toBeCloseTo(1.26);
    expect(ropeDist(BATSMAN, { x: 1, y: 0 })).toBeCloseTo(Math.sqrt(1 - 0.26 * 0.26));
  });
  it("a rolling ball slows to a stop", () => {
    expect(rollDistAt(2, 1, 0)).toBe(0);
    expect(rollDistAt(2, 1, 1)).toBe(2);
    expect(rollDistAt(2, 1, 5)).toBe(2);
    expect(rollDistAt(2, 1, 0.5)).toBeGreaterThan(1); // faster at the start
  });
  it("more fielders on harder levels, 5 to 7 in all", () => {
    expect(fieldersFor("easy")).toHaveLength(5);
    expect(fieldersFor("medium")).toHaveLength(6);
    expect(fieldersFor("hard")).toHaveLength(7);
  });
});

describe("scoring is worked out from the ball, not from dice", () => {
  const airShot = (power: number, angle: number): Shot => ({
    timing: "good",
    offsetMs: 100,
    angle,
    power,
    air: true,
  });
  const groundShot = (power: number, angle: number): Shot => ({
    timing: "good",
    offsetMs: -100,
    angle,
    power,
    air: false,
  });

  it("a full power lofted shot clears the rope for six, whatever the dice say", () => {
    for (const rnd of [zero, half, never]) {
      const o = resolveShot(airShot(1, 0), "hard", rnd);
      expect(o.kind).toBe("six");
      expect(o.runs).toBe(6);
      expect(o.out).toBe(false);
    }
  });
  it("a hard ground shot into an open gap reaches the rope for four", () => {
    const o = resolveShot(groundShot(1, -25), "easy", half);
    expect(o.kind).toBe("four");
    expect(o.runs).toBe(4);
    expect(o.flight!.fielder).toBeNull();
  });
  it("the same shot is stopped when a fielder is in the way", () => {
    const o = resolveShot(groundShot(1, -33), "hard", half); // straight at mid-on
    expect(o.kind).not.toBe("four");
    expect(o.flight!.fielder).not.toBeNull();
  });
  it("a weak lofted shot dropping near a fielder is caught, or dropped when the catch roll fails", () => {
    const weak = airShot(0.449, -35.9); // lands right on mid-on
    const caught = resolveShot(weak, "medium", zero);
    expect(caught.kind).toBe("caught");
    expect(caught.out).toBe(true);
    expect(caught.dismissal).toBe("caught");
    expect(caught.runs).toBe(0);
    const dropped = resolveShot(weak, "medium", never);
    expect(dropped.out).toBe(false);
    expect(dropped.kind).not.toBe("caught");
    expect(dropped.flight!.dropped).toBe(true);
  });
  it("a lofted ball that lands where nobody can reach is not caught", () => {
    const o = resolveShot(airShot(0.5, 60), "easy", zero);
    expect(o.kind).not.toBe("caught");
    expect(o.out).toBe(false);
  });
  it("the catch roll is the only dice use: everything else is the same for any dice", () => {
    const g = groundShot(0.7, 20);
    const a = resolveShot(g, "medium", zero);
    const b = resolveShot(g, "medium", never);
    expect(a.kind).toBe(b.kind);
    expect(a.runs).toBe(b.runs);
  });
  it("a boundary is never given unless the ball reaches the rope with nobody stopping it", () => {
    let fours = 0;
    for (let angle = -60; angle <= 60; angle += 3) {
      for (let p = 0.1; p <= 1; p += 0.05) {
        for (const air of [false, true]) {
          for (const d of ["easy", "medium", "hard"] as const) {
            const o = resolveShot({ timing: "good", offsetMs: 0, angle, power: p, air }, d, half);
            if (o.kind === "four") {
              fours++;
              const f = o.flight!;
              const rope = ropeDist(f.rollFrom, f.dir);
              expect(f.rollDist).toBeGreaterThanOrEqual(rope);
              if (!f.dropped) expect(f.fielder).toBeNull();
            }
            if (o.kind === "six") {
              expect(o.flight!.carry).toBeGreaterThanOrEqual(ropeDist(BATSMAN, o.flight!.dir));
              expect(air).toBe(true);
            }
            expect([0, 1, 2, 3, 4, 6]).toContain(o.runs);
            expect(o.out).toBe(o.kind === "caught");
          }
        }
      }
    }
    expect(fours).toBeGreaterThan(20);
  });
  it("on an open ground more power never means fewer runs", () => {
    let last = -1;
    for (let p = 0.1; p <= 1.001; p += 0.05) {
      const o = resolveShot(groundShot(p, 55), "easy", half); // a gap between mid-off and point
      const value = o.kind === "four" ? 4 : o.runs;
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
    expect(last).toBe(4);
  });
  it("slower fielders give away more runs than quick ones", () => {
    const g = groundShot(0.45, 65);
    expect(resolveShot(g, "easy", half).runs).toBeGreaterThanOrEqual(
      resolveShot(g, "hard", half).runs,
    );
  });
  it("labels read well", () => {
    expect(describeOutcome(resolveShot(airShot(1, 0), "medium", half))).toBe("GOOD. SIX!");
    expect(describeOutcome(resolveShot(airShot(0.449, -35.9), "medium", zero))).toBe(
      "GOOD. OUT! Caught!",
    );
    expect(describeOutcome(resolveShot(groundShot(1, -25), "easy", half))).toBe("GOOD. FOUR!");
  });
});

describe("misses and dismissals", () => {
  it("no swing is always bowled", () => {
    for (const rnd of [zero, half, never]) {
      const o = missOutcome(false, rnd);
      expect(o.kind).toBe("bowled");
      expect(o.out).toBe(true);
      expect(o.dismissal).toBe("bowled");
    }
  });
  it("a swing that misses is bowled or a dot ball depending on the roll", () => {
    expect(missOutcome(true, zero).kind).toBe("bowled");
    expect(missOutcome(true, never).kind).toBe("dot");
    expect(missOutcome(true, never).out).toBe(false);
    expect(describeOutcome(missOutcome(false, zero))).toBe("Bowled!");
  });
});

describe("a match", () => {
  const out = missOutcome(false, zero);
  const six = resolveShot(
    { timing: "perfect", offsetMs: 0, angle: 0, power: 1, air: true },
    "medium",
    half,
  );
  it("adds runs, balls and wickets", () => {
    let t = emptyTally();
    t = applyOutcome(t, six);
    t = applyOutcome(t, out);
    expect(t).toMatchObject({ runs: 6, balls: 2, wickets: 1 });
    expect(t.results).toHaveLength(2);
  });
  it("Quick Play ends on the first wicket, 6-Ball on six balls or two wickets, 10-Wicket on ten wickets or ten overs", () => {
    const tally = (runs: number, balls: number, wickets: number) => ({
      runs,
      balls,
      wickets,
      results: [],
    });
    expect(isOver(tally(0, 100, 0), "quick")).toBe(false);
    expect(isOver(tally(0, 1, 1), "quick")).toBe(true);
    expect(isOver(tally(0, 5, 1), "six")).toBe(false);
    expect(isOver(tally(0, 5, 2), "six")).toBe(true);
    expect(isOver(tally(0, 6, 0), "six")).toBe(true);
    expect(isOver(tally(0, 59, 9), "wickets")).toBe(false);
    expect(isOver(tally(0, 59, 10), "wickets")).toBe(true);
    expect(isOver(tally(0, 60, 3), "wickets")).toBe(true);
    expect(MODES.six.balls).toBe(6);
  });
  it("Target Chase ends at the target, after twelve balls, or on the third wicket", () => {
    const tally = (runs: number, balls: number, wickets: number) => ({
      runs,
      balls,
      wickets,
      results: [],
    });
    expect(isOver(tally(35, 5, 0), "chase", 36)).toBe(false);
    expect(isOver(tally(36, 5, 0), "chase", 36)).toBe(true);
    expect(isOver(tally(10, 11, 2), "chase", 36)).toBe(false);
    expect(isOver(tally(10, 12, 2), "chase", 36)).toBe(true);
    expect(isOver(tally(10, 4, 3), "chase", 36)).toBe(true);
    // a target only matters in the chase
    expect(isOver(tally(500, 1, 0), "wickets")).toBe(false);
  });
  it("the chase target is set by the difficulty and only exists in the chase", () => {
    expect(targetFor("chase", "easy")).toBe(40);
    expect(targetFor("chase", "medium")).toBe(36);
    expect(targetFor("chase", "hard")).toBe(32);
    expect(targetFor("quick", "medium")).toBeNull();
    expect(targetFor("six", "hard")).toBeNull();
  });
  it("the chase verdict says won, or how many runs short", () => {
    const t = (runs: number) => ({ runs, balls: 12, wickets: 1, results: [] });
    expect(chaseWon(t(36), 36)).toBe(true);
    expect(chaseWon(t(35), 36)).toBe(false);
    expect(chaseVerdict(t(40), 36)).toBe("You won! Target 36 reached");
    expect(chaseVerdict(t(35), 36)).toBe("Lost. 1 run short of 36");
    expect(chaseVerdict(t(20), 36)).toBe("Lost. 16 runs short of 36");
  });
  it("overs are shown as over.ball", () => {
    expect(overs(0)).toBe("0.0");
    expect(overs(13)).toBe("2.1");
  });
  it("the verdict depends on the score and the mode", () => {
    expect(verdict(30, "six")).toBe("Superstar innings");
    expect(verdict(29, "six")).toBe("Match winner");
    expect(verdict(10, "six")).toBe("Solid knock");
    expect(verdict(9, "six")).toBe("Keep practising your timing");
    expect(verdict(24, "wickets")).toBe("Keep practising your timing");
    expect(verdict(25, "wickets")).toBe("Solid knock");
    expect(verdict(80, "wickets")).toBe("Superstar innings");
  });
});
