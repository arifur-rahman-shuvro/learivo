import { describe, expect, it } from "vitest";
import {
  MAX_KICKS,
  ZONES,
  botDive,
  botShot,
  distance,
  matchState,
  resolveKick,
  zoneName,
  type Kick,
  type Outcome,
  type Power,
  type Side,
  type Zone,
} from "./rules.ts";

const z = (col: 0 | 1 | 2, row: 0 | 1): Zone => ({ col, row });
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++] ?? 0.999;
};

describe("resolveKick", () => {
  const aim = z(0, 0);
  it("a soft shot never misses, a hard one can", () => {
    expect(resolveKick(aim, 1, z(2, 1), seq(0))).toBe("goal");
    expect(resolveKick(aim, 3, z(2, 1), seq(0.1))).toBe("miss");
    expect(resolveKick(aim, 3, z(2, 1), seq(0.15))).toBe("goal"); // 0.15 is not below the 15% chance
  });
  it("diving to the same zone saves, more often against a soft shot than a hard one", () => {
    expect(resolveKick(aim, 1, aim, seq(0.5, 0.9))).toBe("saved");
    expect(resolveKick(aim, 1, aim, seq(0.5, 0.96))).toBe("goal");
    expect(resolveKick(aim, 3, aim, seq(0.99, 0.5))).toBe("saved");
    expect(resolveKick(aim, 3, aim, seq(0.99, 0.7))).toBe("goal");
  });
  it("one zone away is a fingertip save only now and then, two zones away never", () => {
    expect(resolveKick(aim, 2, z(1, 0), seq(0.5, 0.1))).toBe("saved");
    expect(resolveKick(aim, 2, z(1, 0), seq(0.5, 0.3))).toBe("goal");
    expect(resolveKick(aim, 2, z(0, 1), seq(0.5, 0.1))).toBe("saved"); // below it counts as one away
    expect(resolveKick(aim, 1, z(2, 0), seq(0.5, 0))).toBe("goal");
    expect(resolveKick(aim, 1, z(2, 1), seq(0.5, 0))).toBe("goal");
  });
  it("measures distance by steps", () => {
    expect(distance(z(0, 0), z(0, 0))).toBe(0);
    expect(distance(z(0, 0), z(1, 0))).toBe(1);
    expect(distance(z(0, 0), z(2, 1))).toBe(3);
  });
});

describe("computer players", () => {
  it("always choose a real zone and power, across the whole range of dice", () => {
    for (let r = 0; r < 1; r += 0.05) {
      expect(ZONES).toContainEqual(botDive(() => r));
      const s = botShot(() => r);
      expect(ZONES).toContainEqual(s.aim);
      expect([1, 2, 3]).toContain(s.power);
    }
    expect(ZONES).toContainEqual(botDive(() => 0.9999999));
  });
  it("names zones for screen readers", () => {
    expect(zoneName(z(0, 0))).toBe("Top left");
    expect(zoneName(z(1, 1))).toBe("Low middle");
    expect(new Set(ZONES.map(zoneName)).size).toBe(6);
  });
});

function kick(shooter: Side, outcome: Outcome, power: Power = 2): Kick {
  return { shooter, outcome, power, aim: z(0, 0), dive: z(2, 1) };
}
/** Plays out the kicks alternately: you first. Each list entry is "g" goal or "x" no goal. */
function play(you: string, bot: string): Kick[] {
  const out: Kick[] = [];
  for (let i = 0; i < Math.max(you.length, bot.length); i++) {
    if (you[i]) out.push(kick("you", you[i] === "g" ? "goal" : "saved"));
    if (bot[i]) out.push(kick("bot", bot[i] === "g" ? "goal" : "miss"));
  }
  return out;
}

describe("matchState", () => {
  it("starts with you to shoot, then alternates", () => {
    expect(matchState([])).toMatchObject({ next: "you", over: false, you: 0, bot: 0 });
    expect(matchState(play("g", ""))).toMatchObject({ next: "bot", you: 1 });
    expect(matchState(play("g", "x"))).toMatchObject({ next: "you", you: 1, bot: 0 });
  });
  it("counts goals only, not saves or misses", () => {
    const m = matchState([
      kick("you", "saved"),
      kick("bot", "miss"),
      kick("you", "goal"),
      kick("bot", "goal"),
    ]);
    expect([m.you, m.bot, m.youTaken, m.botTaken]).toEqual([1, 1, 2, 2]);
  });
  it("ends early when the one behind cannot catch up", () => {
    // you 3 - 0 after three each: bot has two left, cannot reach 3
    expect(matchState(play("ggg", "xxx"))).toMatchObject({ over: true, winner: "you" });
    // still alive at 2 - 0 with three bot kicks to come... bot has taken 3: max 2 more, 0+2 = 2, not above 2
    expect(matchState(play("gg", "xx")).over).toBe(false);
    // 3 - 0 with the bot still owing three kicks: it can still draw level, so play on
    expect(matchState(play("ggg", "xx")).over).toBe(false);
    // bot ahead 3 - 0 with you having taken only 3 of 5
    expect(matchState(play("xxx", "ggg"))).toMatchObject({ over: true, winner: "bot" });
  });
  it("a full five each decides it, or goes to sudden death on a tie", () => {
    expect(matchState(play("ggggx", "gggxx"))).toMatchObject({
      over: true,
      winner: "you",
      suddenDeath: true,
    });
    expect(matchState(play("gggxx", "gggxx"))).toMatchObject({
      over: false,
      suddenDeath: true,
      next: "you",
    });
  });
  it("sudden death: ends only after a full pair with different goals, otherwise keeps going", () => {
    const tie = "gggxx";
    expect(matchState(play(tie + "g", tie))).toMatchObject({ over: false, next: "bot" }); // you went first, bot still to kick
    expect(matchState(play(tie + "g", tie + "x"))).toMatchObject({ over: true, winner: "you" });
    expect(matchState(play(tie + "x", tie + "g"))).toMatchObject({ over: true, winner: "bot" });
    expect(matchState(play(tie + "g", tie + "g"))).toMatchObject({ over: false, next: "you" });
  });
  it("a tie that survives MAX_KICKS each is a draw, so a match always ends", () => {
    const all = "g".repeat(MAX_KICKS);
    expect(matchState(play(all, all))).toMatchObject({ over: true, winner: "draw" });
    const nine = "g".repeat(MAX_KICKS - 1);
    expect(matchState(play(nine, nine)).over).toBe(false);
  });
  it("every possible match ends, and never before its winner is certain", () => {
    // all 2^k outcome strings up to 12 kicks each would be big; walk the tree depth-first instead
    let ended = 0;
    const walk = (kicks: Kick[]) => {
      const m = matchState(kicks);
      if (m.over) {
        ended++;
        expect(m.winner).not.toBeNull();
        expect(kicks.length).toBeLessThanOrEqual(2 * MAX_KICKS);
        return;
      }
      for (const o of ["goal", "saved"] as const) walk([...kicks, kick(m.next!, o)]);
    };
    walk([]);
    expect(ended).toBeGreaterThan(1000);
  });
});
