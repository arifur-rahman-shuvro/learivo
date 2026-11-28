import { beforeEach, describe, expect, it } from "vitest";
import type { Difficulty, ModeId, Rnd } from "./config.ts";
import { CricketEngine, type GameEvent } from "./engine.ts";

/*
 * Dice of 0 give: a normal delivery, run-up 700 ms, speed 1300 ms at medium (ramp: -15 ms per ball).
 * The ball is released at 700 and reaches the bat at 700 + 1300 = 2000 ms.
 */
let T = 0;
let dice: Rnd = () => 0;
let events: GameEvent[] = [];

function make(mode: ModeId = "quick", difficulty: Difficulty = "medium") {
  const e = new CricketEngine({
    mode,
    difficulty,
    now: () => T,
    rnd: () => dice(),
    onEvent: (ev) => events.push(ev),
  });
  e.start();
  return e;
}
const at = (e: CricketEngine, ms: number) => {
  T = ms;
  e.update();
};
/** Steps the clock 1 ms at a time until the condition holds. */
function until(e: CricketEngine, cond: () => boolean, limit = 20000) {
  for (let i = 0; i < limit && !cond(); i++) at(e, T + 1);
  expect(cond()).toBe(true);
}
function bowlNext(e: CricketEngine) {
  until(e, () => e.phase === "bowling");
  return T + e.delivery.speedMs; // when the ball reaches the bat
}
function playBall(e: CricketEngine, offset: number, aim = 0) {
  const arrive = bowlNext(e);
  at(e, arrive + offset);
  e.swing(aim);
  until(e, () => e.phase === "result" || e.phase === "over");
}

beforeEach(() => {
  T = 1000;
  dice = () => 0;
  events = [];
});

describe("a delivery", () => {
  it("the bowler runs in, then releases the ball", () => {
    const e = make();
    expect(e.phase).toBe("ready");
    at(e, 1699);
    expect(e.phase).toBe("ready");
    at(e, 1700);
    expect(e.phase).toBe("bowling");
    expect(events).toEqual(["deliver"]);
  });
  it("a tap while the bowler is running in does nothing", () => {
    const e = make();
    at(e, 1300);
    expect(e.swing()).toBe(false);
    expect(e.phase).toBe("ready");
    expect(e.tally.balls).toBe(0);
  });
  it("a perfect swing hits a six and the runs land in the tally when the ball has finished", () => {
    const e = make();
    const arrive = bowlNext(e);
    at(e, arrive);
    expect(e.swing()).toBe(true);
    expect(e.phase).toBe("play");
    expect(e.outcome!.kind).toBe("six");
    expect(e.tally.runs).toBe(0); // not yet: the ball is still in the air
    until(e, () => e.phase === "result");
    expect(e.tally).toMatchObject({ runs: 6, balls: 1, wickets: 0 });
    expect(events).toEqual(["deliver", "swing", "hit", "six"]);
  });
  it("the swing reports how early or late it was", () => {
    const e = make();
    const arrive = bowlNext(e);
    at(e, arrive - 120);
    e.swing();
    expect(e.offsetMs).toBe(-120);
  });
  it("an early swing waits for the ball to arrive before it connects", () => {
    const e = make();
    const arrive = bowlNext(e);
    at(e, arrive - 200);
    e.swing();
    expect(e.phase).toBe("swung");
    at(e, arrive - 1);
    expect(e.phase).toBe("swung");
    at(e, arrive);
    expect(e.phase).toBe("play");
  });
  it("a late swing connects at once", () => {
    const e = make();
    const arrive = bowlNext(e);
    at(e, arrive + 150);
    e.swing();
    expect(e.phase).toBe("play");
    expect(e.outcome!.timing).toBe("good");
  });
  it("a second tap on the same ball does nothing", () => {
    const e = make();
    const arrive = bowlNext(e);
    at(e, arrive - 100);
    expect(e.swing()).toBe(true);
    const out = e.outcome;
    expect(e.swing()).toBe(false);
    at(e, arrive);
    expect(e.swing()).toBe(false);
    expect(e.outcome).toBe(out);
    expect(events.filter((x) => x === "swing")).toHaveLength(1);
  });
  it("a swing far too early or too late misses", () => {
    for (const off of [-400, 400]) {
      T = 1000;
      events = [];
      const e = make();
      const arrive = bowlNext(e);
      at(e, arrive + off);
      e.swing();
      expect(e.outcome!.timing).toBe("miss");
      expect(e.outcome!.kind).toBe("bowled"); // dice 0
    }
  });
  it("no swing at all: the ball goes through and the batter is bowled", () => {
    const e = make();
    const arrive = bowlNext(e);
    at(e, arrive + 380 + 24);
    expect(e.phase).toBe("bowling");
    at(e, arrive + 380 + 25);
    expect(e.phase).toBe("play");
    expect(e.outcome!.kind).toBe("bowled");
    expect(e.offsetMs).toBeNull();
    until(e, () => e.phase === "result");
    expect(e.tally).toMatchObject({ runs: 0, balls: 1, wickets: 1 });
    expect(events).toContain("wicket");
  });
  it("the result stays up, then the next delivery starts by itself", () => {
    const e = make("six");
    playBall(e, 0);
    expect(e.phase).toBe("result");
    const balls = e.tally.balls;
    for (let i = 0; i < 5; i++) {
      at(e, T + 100);
      expect(e.phase).toBe("result");
    }
    until(e, () => e.phase === "ready");
    expect(e.tally.balls).toBe(balls);
    expect(e.outcome).toBeNull();
  });
  it("scores nothing twice however often update runs", () => {
    const e = make("six");
    playBall(e, 0);
    for (let i = 0; i < 20; i++) e.update();
    expect(e.tally.runs).toBe(6);
    expect(e.tally.balls).toBe(1);
  });
});

describe("how an innings ends", () => {
  it("Quick Play ends with the first wicket", () => {
    const e = make("quick");
    bowlNext(e);
    until(e, () => e.phase === "over");
    expect(e.tally.wickets).toBe(1);
    expect(events.at(-1)).toBe("over");
  });
  it("6-Ball Challenge ends after six balls", () => {
    const e = make("six");
    for (let i = 0; i < 6; i++) {
      expect(e.phase).not.toBe("over");
      playBall(e, 0);
      if (i < 5) until(e, () => e.phase === "ready");
    }
    until(e, () => e.phase === "over");
    expect(e.tally).toMatchObject({ runs: 36, balls: 6, wickets: 0 });
  });
  it("Target Chase is won the moment the target is reached", () => {
    const e = make("chase", "medium"); // target 36 = six perfect balls
    expect(e.target).toBe(36);
    for (let i = 0; i < 6; i++) {
      expect(e.phase).not.toBe("over");
      playBall(e, 0);
      if (i < 5) until(e, () => e.phase === "ready");
    }
    until(e, () => e.phase === "over");
    expect(e.tally).toMatchObject({ runs: 36, balls: 6 });
  });
  it("Target Chase is lost on three wickets, with the target unmet", () => {
    const e = make("chase", "medium");
    for (let i = 0; i < 3; i++) {
      bowlNext(e);
      until(e, () => e.phase === "result");
      if (i < 2) until(e, () => e.phase === "ready");
    }
    until(e, () => e.phase === "over");
    expect(e.tally).toMatchObject({ runs: 0, balls: 3, wickets: 3 });
  });
  it("other modes have no target", () => {
    expect(make("six").target).toBeNull();
  });
  it("the game keeps getting quicker with each ball faced", () => {
    const e = make("six");
    const speeds: number[] = [];
    for (let i = 0; i < 3; i++) {
      bowlNext(e);
      speeds.push(e.delivery.speedMs);
      const arrive = T + e.delivery.speedMs;
      at(e, arrive);
      e.swing();
      until(e, () => e.phase === "ready" || e.phase === "over");
    }
    expect(speeds).toEqual([1300, 1285, 1270]);
  });
  it("nothing moves after the innings is over", () => {
    const e = make("quick");
    bowlNext(e);
    until(e, () => e.phase === "over");
    const t = e.tally;
    e.pause();
    expect(e.phase).toBe("over");
    expect(e.swing()).toBe(false);
    at(e, T + 5000);
    expect(e.tally).toBe(t);
  });
});

describe("pause and resume", () => {
  it("a ball that was on its way is bowled again and is not counted", () => {
    const e = make("six");
    const arrive = bowlNext(e);
    at(e, arrive - 500);
    e.pause();
    expect(e.phase).toBe("paused");
    at(e, arrive + 60000); // a long time away
    expect(e.swing()).toBe(false);
    e.resume();
    expect(e.phase).toBe("ready");
    expect(e.tally.balls).toBe(0);
    expect(e.tally.wickets).toBe(0);
    at(e, T + 100);
    expect(e.phase).toBe("ready"); // the run-up begins again
  });
  it("pausing during the run-up resumes with the remaining run-up", () => {
    const e = make();
    at(e, 1400); // 400 of 700 ms run-up done
    e.pause();
    at(e, 31400);
    e.resume();
    expect(e.phase).toBe("ready");
    at(e, 31400 + 299);
    expect(e.phase).toBe("ready");
    at(e, 31400 + 300);
    expect(e.phase).toBe("bowling");
  });
  it("pausing while the ball is in flight after a hit continues the same shot", () => {
    const e = make("six");
    const arrive = bowlNext(e);
    at(e, arrive);
    e.swing();
    at(e, T + 300);
    const before = e.view().sincePlay;
    e.pause();
    at(e, T + 50000);
    expect(e.view().sincePlay).toBe(before); // frozen
    e.resume();
    expect(e.phase).toBe("play");
    expect(e.view().sincePlay).toBe(before);
    until(e, () => e.phase === "result");
    expect(e.tally.runs).toBe(6);
  });
  it("pausing on the result keeps it for its full time", () => {
    const e = make("six");
    playBall(e, 0);
    e.pause();
    at(e, T + 60000);
    e.resume();
    expect(e.phase).toBe("result");
    at(e, T + 1000);
    expect(e.phase).toBe("result");
    until(e, () => e.phase === "ready");
  });
  it("pause and resume do nothing in the wrong state", () => {
    const e = make();
    e.resume();
    expect(e.phase).toBe("ready");
    e.pause();
    e.pause();
    expect(e.phase).toBe("paused");
    e.resume();
    e.resume();
    expect(e.phase).toBe("ready");
  });
});

describe("restart and notification", () => {
  it("start() begins again with an empty tally", () => {
    const e = make("six");
    playBall(e, 0);
    e.start();
    expect(e.tally).toMatchObject({ runs: 0, balls: 0, wickets: 0 });
    expect(e.phase).toBe("ready");
  });
  it("listeners hear about changes until they unsubscribe", () => {
    const e = make();
    let n = 0;
    const off = e.subscribe(() => n++);
    at(e, 1700);
    expect(n).toBe(1);
    off();
    at(e, 1700 + 5000);
    expect(n).toBe(1);
  });
});

describe("what the screen is told", () => {
  it("the ball travels from the bowler to the bat while it is bowled", () => {
    const e = make();
    const arrive = bowlNext(e);
    const start = e.view().ball;
    expect(start.visible).toBe(true);
    expect(start.y).toBeCloseTo(-0.42);
    at(e, arrive - 650);
    const mid = e.view().ball;
    expect(mid.y).toBeCloseTo(-0.08, 1);
    at(e, arrive - 1);
    expect(e.view().ball.y).toBeCloseTo(0.26, 1);
  });
  it("the bowler is behind the crease during the run-up and the ball is hidden", () => {
    const e = make();
    expect(e.view().released).toBe(false);
    expect(e.view().ball.visible).toBe(false);
    expect(e.view().bowler.y).toBeLessThan(-0.42);
    bowlNext(e);
    expect(e.view().released).toBe(true);
  });
  it("a swinging ball curves sideways in flight and is straight at the bat", () => {
    dice = () => 0.999; // swing, run-up 1299, swing direction right
    const e = make("quick", "medium");
    const arrive = bowlNext(e);
    at(e, arrive - e.delivery.speedMs / 2);
    expect(Math.abs(e.view().ball.x)).toBeGreaterThan(0.05);
    at(e, arrive);
    expect(Math.abs(e.view().ball.x)).toBeLessThan(0.001);
  });
  it("after a six the ball ends far beyond the middle and no fielder moves", () => {
    const e = make("six");
    const arrive = bowlNext(e);
    at(e, arrive);
    e.swing();
    at(e, T + e.outcome!.flight!.duration * 1000);
    const v = e.view();
    expect(Math.hypot(v.ball.x, v.ball.y)).toBeGreaterThan(1);
    expect(v.fielders[0]).toEqual({ x: 0.42, y: -0.32 });
  });
  it("a fielder runs to the ball when he is the one to stop it", () => {
    const e = make("six", "hard");
    const arrive = bowlNext(e);
    at(e, arrive - 60); // early: a ground shot to the leg side
    e.swing();
    until(e, () => e.phase === "result");
    const fl = e.outcome!.flight!;
    expect(fl.fielder).not.toBeNull();
    const v = e.view();
    const f = v.fielders[fl.fielder!]!;
    expect(Math.hypot(f.x - fl.stop.x, f.y - fl.stop.y)).toBeLessThan(0.001);
  });
  it("bowled brings the stumps down", () => {
    const e = make();
    const arrive = bowlNext(e);
    at(e, arrive + 405);
    expect(e.phase).toBe("play");
    expect(e.view().stumpsDown).toBe(0);
    at(e, T + 450);
    expect(e.view().stumpsDown).toBe(1);
  });
  it("a ball nobody swings at carries on past the bat to the stumps", () => {
    const e = make();
    const arrive = bowlNext(e);
    at(e, arrive + 100);
    expect(e.view().ball.y).toBeGreaterThan(0.3);
    at(e, arrive + 300);
    expect(e.view().ball.y).toBeCloseTo(0.4);
    at(e, arrive + 405);
    expect(e.view().ball.y).toBeCloseTo(0.4);
  });
  it("the bat swings over about a fifth of a second", () => {
    const e = make();
    const arrive = bowlNext(e);
    expect(e.view().swing).toBe(0);
    at(e, arrive - 100);
    e.swing();
    at(e, T + 110);
    expect(e.view().swing).toBeCloseTo(0.5);
    at(e, T + 1000);
    expect(e.view().swing).toBe(1);
  });
});
