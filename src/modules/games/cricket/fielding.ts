import {
  BATSMAN,
  DIFFICULTIES,
  FIELD_SPOTS,
  KEEPER,
  PHYSICS as P,
  type Difficulty,
  type Rnd,
  type Vec,
} from "./config.ts";
import type { Shot } from "./shot.ts";
import { TIMING_WORD, type Timing } from "./timing.ts";

export interface Fielder {
  id: number;
  pos: Vec;
  speed: number;
  reaction: number;
  catching: number;
  radius: number;
}

export function fieldersFor(d: Difficulty): Fielder[] {
  const c = DIFFICULTIES[d];
  return FIELD_SPOTS.slice(0, c.fielders).map((pos, id) => ({
    id,
    pos,
    speed: c.fielderSpeed,
    reaction: c.reaction,
    catching: c.catching,
    radius: P.fielderRadius,
  }));
}

export type OutcomeKind = "dot" | "runs" | "four" | "six" | "caught" | "bowled";
export type Dismissal = "bowled" | "caught";

/** Everything the screen needs to animate a shot. Times are seconds after the bat hits the ball. */
export interface Flight {
  start: Vec;
  dir: Vec;
  /** Distance an air ball carries before it lands (0 for a ground shot). */
  carry: number;
  airTime: number;
  rollFrom: Vec;
  /** The full distance and time the ball would roll if nobody stopped it. */
  rollDist: number;
  rollT: number;
  /** How long it really rolled: until it was stopped, crossed the rope or came to rest. */
  rollTime: number;
  stop: Vec;
  fielder: number | null;
  fielderTime: number;
  caught: boolean;
  dropped: boolean;
  duration: number;
}

export interface Outcome {
  kind: OutcomeKind;
  runs: number;
  out: boolean;
  dismissal: Dismissal | null;
  timing: Timing;
  label: string;
  flight: Flight | null;
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const along = (o: Vec, d: Vec, s: number): Vec => ({ x: o.x + d.x * s, y: o.y + d.y * s });

/** How far from `o` heading along `d` the rope (the unit circle) is. */
export function ropeDist(o: Vec, d: Vec): number {
  const b = o.x * d.x + o.y * d.y;
  return -b + Math.sqrt(b * b - (o.x * o.x + o.y * o.y - 1));
}

/** Distance covered by a rolling ball after `t` seconds, with the ball slowing to a stop at `T`. */
export function rollDistAt(dist: number, T: number, t: number): number {
  const u = Math.min(1, Math.max(0, t / T));
  return dist * (1 - (1 - u) * (1 - u));
}
/** Time a rolling ball takes to cover `s` of its full `dist`. */
function rollTimeFor(dist: number, T: number, s: number): number {
  return T * (1 - Math.sqrt(Math.max(0, 1 - s / dist)));
}

function runsLabel(runs: number): string {
  return runs === 0 ? "Dot ball" : runs === 1 ? "1 run" : `${runs} runs`;
}

function blank(timing: Timing, over: Partial<Outcome>): Outcome {
  return {
    kind: "dot",
    runs: 0,
    out: false,
    dismissal: null,
    timing,
    label: "Dot ball",
    flight: null,
    ...over,
  };
}

/** The bat missed or was never swung: bowled, or the keeper gathers it (dice: one roll). */
export function missOutcome(swung: boolean, rnd: Rnd): Outcome {
  if (!swung || rnd() < P.missBowled) {
    return blank("miss", { kind: "bowled", out: true, dismissal: "bowled", label: "Bowled!" });
  }
  return blank("miss", { kind: "dot", label: "Missed. Dot ball" });
}

interface RollResult {
  kind: "dot" | "runs" | "four";
  runs: number;
  flight: Flight;
}

/**
 * A ball rolling along the ground from `from`. Fielders can cut it off; if it reaches the rope it is
 * four; otherwise the batters run while the ball is fetched and thrown back.
 */
function rollBall(
  from: Vec,
  dir: Vec,
  dist0: number,
  t0: number,
  field: Fielder[],
  carry: number,
  airTime: number,
  start: Vec,
  landing: Vec | null,
): RollResult {
  void landing;
  const T = P.rollTime[0] + P.rollTime[1] * dist0;
  const sRope = ropeDist(from, dir);
  const sMax = Math.min(dist0, sRope);
  let hit: { s: number; f: Fielder; tf: number } | null = null;
  for (let s = 0.05; s <= sMax && !hit; s += 0.01) {
    const p = along(from, dir, s);
    const tBall = rollTimeFor(dist0, T, s);
    for (const f of field) {
      const tf = f.reaction + Math.max(0, dist(f.pos, p) - f.radius) / f.speed;
      if (tf <= tBall && (!hit || s < hit.s)) hit = { s, f, tf };
    }
  }
  const base = {
    start,
    dir,
    carry,
    airTime,
    rollFrom: from,
    rollDist: dist0,
    rollT: T,
    caught: false,
    dropped: false,
  };
  if (!hit && dist0 >= sRope) {
    const tR = rollTimeFor(dist0, T, sRope);
    const stop = along(from, dir, sRope);
    return {
      kind: "four",
      runs: 4,
      flight: {
        ...base,
        rollTime: tR,
        stop,
        fielder: null,
        fielderTime: 0,
        duration: t0 + tR + 0.3,
      },
    };
  }
  let stop: Vec;
  let tBall: number;
  let tColl: number;
  let fielder: number | null;
  let tf: number;
  let rollTime: number;
  if (hit) {
    stop = along(from, dir, hit.s);
    tBall = rollTimeFor(dist0, T, hit.s);
    rollTime = tBall;
    tColl = Math.max(tBall, hit.tf);
    fielder = hit.f.id;
    tf = hit.tf;
  } else {
    stop = along(from, dir, dist0);
    rollTime = T;
    let best = field[0]!;
    let bt = Infinity;
    for (const f of field) {
      const t = f.reaction + Math.max(0, dist(f.pos, stop) - f.radius) / f.speed;
      if (t < bt) {
        bt = t;
        best = f;
      }
    }
    tColl = Math.max(T, bt);
    fielder = best.id;
    tf = bt;
  }
  const tThrow = P.throwBase + dist(stop, KEEPER) / P.throwSpeed;
  const raw = Math.floor((t0 + tColl + tThrow - P.runBase) / P.runTime);
  const runs = Math.min(P.maxRuns, Math.max(0, raw));
  return {
    kind: runs === 0 ? "dot" : "runs",
    runs,
    flight: { ...base, rollTime, stop, fielder, fielderTime: tf, duration: t0 + tColl + 0.3 },
  };
}

/**
 * Plays out one shot on the ground. All scoring comes from where the ball goes and who can reach it;
 * nothing is awarded by a dice roll. The only dice are the catch (one roll, when a fielder gets there).
 */
export function resolveShot(shot: Shot, d: Difficulty, rnd: Rnd): Outcome {
  const field = fieldersFor(d);
  const a = (shot.angle * Math.PI) / 180;
  const dir: Vec = { x: Math.sin(a), y: -Math.cos(a) };
  const O = BATSMAN;
  const sRope = ropeDist(O, dir);

  if (!shot.air) {
    const r = rollBall(
      O,
      dir,
      P.groundDist[0] + P.groundDist[1] * shot.power,
      0,
      field,
      0,
      0,
      O,
      null,
    );
    return fromRoll(shot.timing, r);
  }

  const carry = P.airCarry[0] + P.airCarry[1] * shot.power;
  const airTime = P.airTime[0] + P.airTime[1] * carry;
  if (carry >= sRope) {
    const stop = along(O, dir, sRope + 0.25);
    return blank(shot.timing, {
      kind: "six",
      runs: 6,
      label: "SIX!",
      flight: {
        start: O,
        dir,
        carry,
        airTime,
        rollFrom: stop,
        rollDist: 0,
        rollT: 1,
        rollTime: 0,
        stop,
        fielder: null,
        fielderTime: 0,
        caught: false,
        dropped: false,
        duration: airTime + 0.25,
      },
    });
  }

  const L = along(O, dir, carry);
  let best: Fielder | null = null;
  let bestT = Infinity;
  for (const f of field) {
    const tf = f.reaction + P.airJudge + Math.max(0, dist(f.pos, L) - f.radius) / f.speed;
    if (tf <= airTime && tf < bestT) {
      best = f;
      bestT = tf;
    }
  }
  if (best) {
    const p = best.catching * (1 - P.catchPenalty * (bestT / airTime));
    if (rnd() < p) {
      return blank(shot.timing, {
        kind: "caught",
        out: true,
        dismissal: "caught",
        label: "Caught!",
        flight: {
          start: O,
          dir,
          carry,
          airTime,
          rollFrom: L,
          rollDist: 0,
          rollT: 1,
          rollTime: 0,
          stop: L,
          fielder: best.id,
          fielderTime: bestT,
          caught: true,
          dropped: false,
          duration: airTime + 0.4,
        },
      });
    }
  }
  const loose = best ? 0.12 : P.looseRoll[0] + P.looseRoll[1] * shot.power;
  const r = rollBall(L, dir, loose, airTime, field, carry, airTime, O, L);
  r.flight.dropped = best !== null;
  if (best) r.flight.fielder = best.id;
  return fromRoll(shot.timing, r);
}

function fromRoll(timing: Exclude<Timing, "miss">, r: RollResult): Outcome {
  return blank(timing, {
    kind: r.kind,
    runs: r.runs,
    label: r.kind === "four" ? "FOUR!" : runsLabel(r.runs),
    flight: r.flight,
  });
}

/** The big word shown with the result, e.g. "PERFECT. SIX!". */
export function describe(o: Outcome): string {
  if (o.kind === "bowled") return o.label;
  if (o.timing === "miss") return o.label;
  return `${TIMING_WORD[o.timing]}. ${o.out ? `OUT! ${o.label}` : o.label}`;
}
