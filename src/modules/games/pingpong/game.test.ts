import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, FLOW, PHYSICS as P, type Level, type Mode, type Rules } from "./config.ts";
import { Game, type GameEvent } from "./game.ts";

const R5: Rules = { target: 5, winBy: 2, bestOf: 1 };
const dice =
  (v = 0.5) =>
  () =>
    v;
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function make(mode: Mode = "local", rules: Rules = R5, rnd = dice(), extra: object = {}) {
  const events: GameEvent[] = [];
  const g = new Game({ mode, rules, rnd, onEvent: (e) => events.push(e), ...extra });
  return { g, events };
}
/** Runs the clock in 1/60 s frames; `each` can steer before every frame. */
function play(g: Game, seconds: number, each?: (g: Game) => void) {
  for (let i = 0; i < seconds * 60; i++) {
    each?.(g);
    g.advance(1 / 60);
  }
}
function until(g: Game, cond: () => boolean, limit = 300, each?: (g: Game) => void) {
  for (let i = 0; i < limit * 60 && !cond(); i++) {
    each?.(g);
    g.advance(1 / 60);
  }
  expect(cond()).toBe(true);
}
/** Player 0 follows the ball; player 1 stays away from it, so player 0 wins every point. */
const zeroWins = (g: Game) => {
  g.setTarget(0, g.world.ball.x);
  g.setTarget(1, g.world.ball.x > 0.5 ? 0.1 : 0.9);
};
const types = (ev: GameEvent[]) => ev.map((e) => e.type);

describe("starting", () => {
  it("waits in idle until started and nothing moves", () => {
    const { g } = make();
    expect(g.phase).toBe("idle");
    play(g, 2);
    expect(g.phase).toBe("idle");
    expect(g.view().ball.visible).toBe(false);
  });
  it("counts 3, 2, 1, then the ball is on the server's paddle and is served", () => {
    const { g, events } = make();
    g.start();
    expect(g.phase).toBe("countdown");
    expect(g.view().count).toBe(3);
    play(g, FLOW.countdownStep + 0.05);
    expect(g.view().count).toBe(2);
    play(g, FLOW.countdownStep);
    expect(g.view().count).toBe(1);
    expect(events.filter((e) => e.type === "tick").map((e) => (e as { n: number }).n)).toEqual([
      3, 2, 1,
    ]);
    until(g, () => g.phase === "serve", 5);
    const b = g.view().ball;
    expect(b.vy).toBe(0); // still on the paddle
    expect(b.y).toBeGreaterThan(1.4);
    until(g, () => g.phase === "rally", 5);
    expect(g.view().ball.vy).toBeLessThan(0); // player 0 serves up the table
    expect(types(events)).toContain("serve");
  });
  it("starting twice does not restart the countdown", () => {
    const { g } = make();
    g.start();
    play(g, 1);
    const t = g.view().phaseTime;
    g.start();
    expect(g.view().phaseTime).toBe(t);
  });
});

describe("a point", () => {
  it("goes to the player whose opponent misses, and is announced once", () => {
    const { g, events } = make();
    g.start();
    until(g, () => g.phase === "point", 30, zeroWins);
    expect(g.score.points).toEqual([1, 0]);
    expect(events.filter((e) => e.type === "point")).toHaveLength(1);
    expect(events.find((e) => e.type === "point")).toMatchObject({ type: "point", winner: 0 });
    expect(g.view().pointWinner).toBe(0);
    expect(g.stats.players[0].points).toBe(1);
    // and the next serve comes after the pause
    until(g, () => g.phase === "serve", 5, zeroWins);
    expect(g.score.points).toEqual([1, 0]);
  });
  it("the server changes after two points", () => {
    const { g } = make();
    g.start();
    const servers: number[] = [];
    for (let i = 0; i < 3; i++) {
      until(g, () => g.phase === "serve", 30, zeroWins);
      servers.push(g.view().server);
      until(g, () => g.phase === "point", 30, zeroWins);
    }
    expect(servers).toEqual([0, 0, 1]);
  });
  it("a rally counts every hit, speeds the ball up and remembers the longest", () => {
    const { g, events } = make();
    g.start();
    const meet = (x: Game) => {
      x.setTarget(0, x.world.ball.x);
      x.setTarget(1, x.world.ball.x);
    };
    until(g, () => g.rally >= 12, 60, meet);
    expect(g.stats.longestRally).toBeGreaterThanOrEqual(12);
    expect(
      events.filter((e) => e.type === "milestone").map((e) => (e as { rally: number }).rally),
    ).toEqual([5, 10]);
    expect(g.view().speed).toBeGreaterThan(P.serveSpeed / P.maxSpeed);
    const hits = events.filter((e) => e.type === "hit").length;
    expect(hits).toBe(g.stats.players[0].hits + g.stats.players[1].hits);
    expect(g.stats.players[0].hits).toBeGreaterThan(0);
    expect(g.stats.players[1].hits).toBeGreaterThan(0);
    expect(g.stats.players[0].perfect).toBeGreaterThan(0);
  });
  it("a perfect hit starts a combo and a clumsy one ends it", () => {
    const { g, events } = make();
    g.start();
    until(
      g,
      () => g.rally >= 4,
      30,
      (x) => {
        x.setTarget(0, x.world.ball.x);
        x.setTarget(1, x.world.ball.x);
      },
    );
    const hits = events.filter((e) => e.type === "hit") as Extract<GameEvent, { type: "hit" }>[];
    expect(hits.some((h) => h.combo >= 2)).toBe(true);
    expect(g.stats.players[0].maxCombo).toBeGreaterThanOrEqual(2);
  });
});

describe("winning", () => {
  it("a match to 5 ends 5-0 and declares the winner once", () => {
    const { g, events } = make();
    g.start();
    until(g, () => g.phase === "matchComplete", 200, zeroWins);
    expect(g.winner).toBe(0);
    expect(g.score.points).toEqual([5, 0]);
    expect(g.score.sets).toEqual([1, 0]);
    expect(events.filter((e) => e.type === "matchEnd")).toEqual([{ type: "matchEnd", winner: 0 }]);
    expect(g.stats.players[0].points).toBe(5);
    // nothing moves afterwards
    const before = JSON.stringify(g.view());
    play(g, 3);
    expect(JSON.stringify({ ...g.view(), phaseTime: 0 })).toBe(
      JSON.stringify({ ...JSON.parse(before), phaseTime: 0 }),
    );
    expect(g.phase).toBe("matchComplete");
  });
  it("match point is announced when it is reached", () => {
    const { g, events } = make();
    g.start();
    until(g, () => g.phase === "matchComplete", 200, zeroWins);
    expect(events.filter((e) => e.type === "matchPoint")).toEqual([
      { type: "matchPoint", player: 0 },
    ]);
  });
  it("deuce: 5-4 is not a win, 6-4 is", () => {
    const { g } = make();
    g.start();
    g.score = { ...g.score, points: [4, 4] };
    until(g, () => g.phase === "point", 60, zeroWins);
    expect(g.score.points).toEqual([5, 4]);
    expect(g.view().deuce).toBe(true);
    until(g, () => g.phase === "serve", 10, zeroWins);
    until(g, () => g.phase === "point" || g.phase === "matchComplete", 60, zeroWins);
    until(g, () => g.phase === "matchComplete", 20, zeroWins);
    expect(g.score.points).toEqual([6, 4]);
    expect(g.winner).toBe(0);
  });
  it("best of 3: a set ends, a new countdown begins, and the second set wins the match", () => {
    const { g, events } = make("local", { target: 5, winBy: 2, bestOf: 3 });
    g.start();
    until(g, () => g.phase === "setComplete", 200, zeroWins);
    expect(g.score.sets).toEqual([1, 0]);
    expect(g.score.points).toEqual([0, 0]);
    expect(events.filter((e) => e.type === "setEnd")).toEqual([{ type: "setEnd", winner: 0 }]);
    until(g, () => g.phase === "countdown", 10, zeroWins);
    until(g, () => g.phase === "serve", 10, zeroWins);
    // the first server alternates between sets: player 1 serves the second set
    expect(g.view().server).toBe(1);
    until(g, () => g.phase === "matchComplete", 200, zeroWins);
    expect(g.score.sets).toEqual([2, 0]);
    expect(g.winner).toBe(0);
  });
});

describe("pause, resume and restart", () => {
  it("a paused game does not move at all", () => {
    const { g, events } = make();
    g.start();
    until(g, () => g.phase === "rally", 10);
    play(g, 0.3);
    g.pause();
    expect(g.phase).toBe("paused");
    const frozen = JSON.stringify(g.view());
    play(g, 5, (x) => x.setTarget(0, 0.2));
    expect(JSON.stringify(g.view())).toBe(frozen);
    expect(types(events)).toContain("pause");
    g.pause(); // twice is harmless
    expect(g.phase).toBe("paused");
  });
  it("resume carries on from the same place, after a short moment to get ready", () => {
    const { g, events } = make();
    g.start();
    until(g, () => g.phase === "rally", 10);
    play(g, 0.3);
    const y = g.view().ball.y;
    g.pause();
    g.resume();
    expect(g.phase).toBe("rally");
    expect(types(events)).toContain("resume");
    play(g, 0.5);
    expect(g.view().ball.y).toBeCloseTo(y, 6); // still waiting
    play(g, 1);
    expect(g.view().ball.y).not.toBeCloseTo(y, 2);
  });
  it("pausing in the countdown or a point resumes into the same phase", () => {
    const { g } = make();
    g.start();
    play(g, 0.5);
    g.pause();
    g.resume();
    expect(g.phase).toBe("countdown");
  });
  it("cannot pause before the start, after the end, or while restarting; resume does nothing unless paused", () => {
    const { g } = make();
    g.pause();
    expect(g.phase).toBe("idle");
    g.resume();
    expect(g.phase).toBe("idle");
    g.start();
    until(g, () => g.phase === "matchComplete", 200, zeroWins);
    g.pause();
    expect(g.phase).toBe("matchComplete");
  });
  it("restart gives a fresh match: scores, stats and the ball are reset, then a countdown", () => {
    const { g, events } = make();
    g.start();
    until(g, () => g.phase === "point", 30, zeroWins);
    g.restart();
    expect(g.phase).toBe("restarting");
    g.restart(); // a second tap changes nothing
    until(g, () => g.phase === "countdown", 5);
    expect(g.score.points).toEqual([0, 0]);
    expect(g.score.sets).toEqual([0, 0]);
    expect(g.stats.players[0].points).toBe(0);
    expect(g.stats.longestRally).toBe(0);
    expect(g.winner).toBeNull();
    expect(g.view().pointWinner).toBeNull();
    // the new match plays normally
    until(g, () => g.phase === "point", 30, zeroWins);
    expect(g.score.points).toEqual([1, 0]);
    expect(events.filter((e) => e.type === "point")).toHaveLength(2);
  });
  it("restart works from the end of a match and from a pause", () => {
    const { g } = make();
    g.start();
    until(g, () => g.phase === "matchComplete", 200, zeroWins);
    g.restart();
    until(g, () => g.phase === "countdown", 5);
    expect(g.winner).toBeNull();
    g.pause();
    g.restart();
    until(g, () => g.phase === "countdown", 5);
    expect(g.score.points).toEqual([0, 0]);
  });
});

describe("the modes", () => {
  it("two players move their own paddles at the same time", () => {
    const { g } = make("local");
    g.start();
    g.setTarget(0, 0.2);
    g.setTarget(1, 0.8);
    play(g, 1);
    expect(g.view().paddles[0]).toBeCloseTo(0.2, 2);
    expect(g.view().paddles[1]).toBeCloseTo(0.8, 2);
    g.setTarget(0, 0.7);
    play(g, 1);
    expect(g.view().paddles[0]).toBeCloseTo(0.7, 2);
    expect(g.view().paddles[1]).toBeCloseTo(0.8, 2);
  });
  it("against the computer, the top paddle ignores a finger and moves by itself", () => {
    const { g } = make("ai", R5, seeded(3), { level: "hard" });
    g.start();
    until(g, () => g.phase === "rally", 10);
    g.setTarget(1, 0.05);
    play(g, 0.5);
    expect(g.view().paddles[1]).toBeGreaterThan(0.2);
    // the human paddle does follow
    g.setTarget(0, 0.3);
    play(g, 1);
    expect(g.view().paddles[0]).toBeCloseTo(0.3, 2);
  });
  it("practice keeps no score: a missed ball just ends the rally and serves again", () => {
    const { g, events } = make("practice");
    g.start();
    until(
      g,
      () => g.rally >= 4,
      40,
      (x) => x.setTarget(0, x.world.ball.x),
    );
    expect(g.stats.players[1].hits).toBeGreaterThanOrEqual(2); // the wall answers
    until(
      g,
      () => g.phase === "point",
      40,
      (x) => x.setTarget(0, x.world.ball.x > 0.5 ? 0.1 : 0.9),
    );
    expect(g.score.points).toEqual([0, 0]);
    expect(events.find((e) => e.type === "point")).toMatchObject({ winner: null });
    expect(g.view().deuce).toBe(false);
    until(g, () => g.phase === "serve", 5);
    until(g, () => g.phase === "rally", 5);
    expect(g.stats.rallies).toBe(1);
    expect(g.phase).not.toBe("matchComplete");
  });
  it("practice speed changes how fast the ball can go", () => {
    const top = (speed: "slow" | "fast") => {
      const { g } = make("practice", DEFAULT_RULES, dice(), { practiceSpeed: speed });
      g.start();
      until(
        g,
        () => g.rally >= 40,
        120,
        (x) => x.setTarget(0, x.world.ball.x),
      );
      return g.stats.players[0].maxSpeed;
    };
    expect(top("slow")).toBeLessThan(top("fast"));
    expect(top("slow")).toBeLessThanOrEqual(P.maxSpeed * 0.75 + 1e-9);
  });
});

describe("robustness", () => {
  it("is the same every time with the same dice", () => {
    const run = () => {
      const { g } = make("ai", R5, seeded(9), { level: "normal" });
      g.start();
      play(g, 40, (x) => x.setTarget(0, x.world.ball.x));
      return JSON.stringify(g.view());
    };
    expect(run()).toBe(run());
  });
  it("the frame rate does not change the game: 30, 60 and 144 frames a second agree closely", () => {
    const at = (fps: number) => {
      const { g } = make("local");
      g.start();
      until(g, () => g.phase === "rally", 10);
      for (let i = 0; i < fps * 1.2; i++) g.advance(1 / fps);
      return g.view().ball;
    };
    const a = at(30);
    const b = at(60);
    const c = at(144);
    expect(a.y).toBeCloseTo(b.y, 1);
    expect(c.y).toBeCloseTo(b.y, 1);
  });
  it("a long freeze (a hidden tab) does not make the ball jump, and bad times are ignored", () => {
    const { g } = make("local");
    g.start();
    until(g, () => g.phase === "rally", 10);
    const y = g.view().ball.y;
    g.advance(30);
    expect(Math.abs(g.view().ball.y - y)).toBeLessThan(P.step * P.maxSteps * P.maxSpeed + 0.01);
    const v = JSON.stringify(g.view());
    g.advance(NaN);
    g.advance(-5);
    g.advance(0);
    expect(JSON.stringify(g.view())).toBe(v);
  });
  it("rapid pause, resume and restart taps leave a valid game", () => {
    const { g } = make("local");
    g.start();
    for (let i = 0; i < 50; i++) {
      play(g, 0.1);
      if (i % 3 === 0) g.pause();
      if (i % 3 === 1) g.resume();
      if (i % 7 === 0) g.restart();
    }
    g.resume();
    play(g, 5);
    expect(["countdown", "serve", "rally", "point", "restarting"]).toContain(g.phase);
    expect(g.score.points[0] + g.score.points[1]).toBeLessThan(20);
  });
});

describe("the computer levels are really different", () => {
  const wins = (a: Level, b: Level, n = 14) => {
    let w = 0;
    for (let k = 0; k < n; k++) {
      const g = new Game({ mode: "ai", rules: R5, bots: [a, b], rnd: seeded(500 + k) });
      g.start();
      for (let i = 0; i < 60 * 600 && g.phase !== "matchComplete"; i++) g.advance(1 / 60);
      expect(g.phase).toBe("matchComplete");
      if (g.winner === 0) w++;
    }
    return w / n;
  };
  it("a stronger level beats a weaker one, every step up the ladder", () => {
    expect(wins("normal", "easy")).toBeGreaterThanOrEqual(0.85);
    expect(wins("hard", "normal")).toBeGreaterThanOrEqual(0.85);
    expect(wins("expert", "hard")).toBeGreaterThanOrEqual(0.85);
    expect(wins("expert", "easy")).toBeGreaterThanOrEqual(0.95);
  }, 60000);
  it("two equal levels are an even match", () => {
    const w = wins("normal", "normal", 20);
    expect(w).toBeGreaterThan(0.2);
    expect(w).toBeLessThan(0.8);
  }, 60000);
});
