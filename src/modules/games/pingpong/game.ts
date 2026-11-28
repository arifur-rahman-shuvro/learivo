import { AiPlayer } from "./ai.ts";
import {
  FLOW,
  LEVELS,
  PADDLE,
  PHYSICS as P,
  PRACTICE,
  type Level,
  type Mode,
  type Player,
  type PracticeSpeed,
  type Rnd,
  type Rules,
} from "./config.ts";
import {
  movePaddle,
  newWorld,
  placeForServe,
  serve,
  speedOf,
  step,
  type Hit,
  type StepEvent,
  type World,
} from "./physics.ts";
import { awardPoint, isDeuce, matchPointFor, newScore, serverFor, type Score } from "./scoring.ts";

/*
 * The match: a state machine that owns the rules, the clock and the dice, and knows nothing about the
 * screen. Time goes in through `advance(seconds)` and the physics runs in fixed steps, so the same
 * inputs always give the same game. A renderer asks `view()` what to draw.
 *
 *   idle -> countdown -> serve -> rally -> point -> (serve | setComplete -> countdown | matchComplete)
 *   any playing phase <-> paused;   any phase -> restarting -> countdown
 */
export type Phase =
  | "idle"
  | "countdown"
  | "serve"
  | "rally"
  | "point"
  | "paused"
  | "setComplete"
  | "matchComplete"
  | "restarting";

export type GameEvent =
  | { type: "tick"; n: number }
  | { type: "serve"; server: Player }
  | { type: "hit"; hit: Hit; rally: number; combo: number }
  | { type: "wall" }
  | { type: "milestone"; rally: number }
  | { type: "point"; winner: Player | null; rally: number }
  | { type: "setEnd"; winner: Player }
  | { type: "matchEnd"; winner: Player }
  | { type: "matchPoint"; player: Player }
  | { type: "pause" }
  | { type: "resume" };

export interface PlayerStats {
  points: number;
  hits: number;
  perfect: number;
  smashes: number;
  maxCombo: number;
  maxSpeed: number;
}
export interface Stats {
  players: [PlayerStats, PlayerStats];
  longestRally: number;
  rallies: number;
  /** Seconds of play (the clock does not run while paused). */
  seconds: number;
}
const blank = (): PlayerStats => ({
  points: 0,
  hits: 0,
  perfect: 0,
  smashes: 0,
  maxCombo: 0,
  maxSpeed: 0,
});

export interface GameOptions {
  mode: Mode;
  rules: Rules;
  /** The computer's level (mode "ai"). */
  level?: Level;
  practiceSpeed?: PracticeSpeed;
  /** Computer players for each side; only for tests that play two computers against each other. */
  bots?: [Level | null, Level | null];
  rnd?: Rnd;
  onEvent?: (e: GameEvent) => void;
}

export interface Effect {
  kind: "hit" | "wall";
  x: number;
  y: number;
  age: number;
  player: Player | null;
  perfect: boolean;
  smash: boolean;
}

export interface View {
  phase: Phase;
  ball: { x: number; y: number; vx: number; vy: number; spin: number; visible: boolean };
  paddles: [number, number];
  score: Score;
  server: Player;
  /** 3, 2, 1 while counting down, otherwise 0. */
  count: number;
  trail: { x: number; y: number }[];
  rally: number;
  /** 0 to 1, the ball's speed against the fastest it can go. */
  speed: number;
  effects: Effect[];
  /** Who won the last point (null in practice, or when none was played). */
  pointWinner: Player | null;
  matchPoint: Player | null;
  deuce: boolean;
  winner: Player | null;
  /** Seconds in the current phase. */
  phaseTime: number;
  mode: Mode;
}

const TRAIL = 16;

export class Game {
  readonly mode: Mode;
  readonly rules: Rules;
  phase: Phase = "idle";
  world: World = newWorld();
  score: Score = newScore(0);
  stats: Stats = this.freshStats();
  winner: Player | null = null;
  rally = 0;
  version = 0;

  private readonly rnd: Rnd;
  private readonly onEvent?: (e: GameEvent) => void;
  private readonly bots: [AiPlayer | null, AiPlayer | null];
  private readonly speedScale: number;
  private readonly wall: Player | null;
  private clock = 0;
  private acc = 0;
  private phaseT = 0;
  private lastTick = 0;
  private pausedFrom: Phase = "idle";
  private grace = 0;
  private pointWinner: Player | null = null;
  private pending: { setWon: Player | null; matchWon: Player | null } = {
    setWon: null,
    matchWon: null,
  };
  private combo: [number, number] = [0, 0];
  private trail: { x: number; y: number }[] = [];
  private effects: { kind: "hit" | "wall"; x: number; y: number; at: number; hit?: Hit }[] = [];
  private stepCount = 0;

  constructor(o: GameOptions) {
    this.mode = o.mode;
    this.rules = o.rules;
    this.rnd = o.rnd ?? Math.random;
    this.onEvent = o.onEvent;
    const lv: [Level | null, Level | null] = o.bots ?? [
      null,
      o.mode === "ai" ? (o.level ?? "normal") : null,
    ];
    this.bots = [
      lv[0] ? new AiPlayer(LEVELS[lv[0]], 0, this.rnd) : null,
      lv[1] ? new AiPlayer(LEVELS[lv[1]], 1, this.rnd) : null,
    ];
    this.speedScale = o.mode === "practice" ? PRACTICE[o.practiceSpeed ?? "normal"] : 1;
    this.wall = o.mode === "practice" ? 1 : null;
    this.applyBotSpeeds();
  }

  private freshStats(): Stats {
    return { players: [blank(), blank()], longestRally: 0, rallies: 0, seconds: 0 };
  }
  private applyBotSpeeds() {
    for (const p of [0, 1] as const) {
      this.world.paddles[p].maxSpeed = this.bots[p]?.speed ?? PADDLE.maxSpeed;
    }
  }
  private emit(e: GameEvent) {
    this.onEvent?.(e);
  }
  private go(phase: Phase) {
    this.phase = phase;
    this.phaseT = 0;
    this.version++;
  }

  /** From the menu into the first countdown. */
  start() {
    if (this.phase !== "idle") return;
    this.beginCountdown();
  }

  private beginCountdown() {
    this.world.ball.vx = 0;
    this.world.ball.vy = 0;
    this.lastTick = 0;
    this.go("countdown");
    this.emit({ type: "tick", n: FLOW.countdown });
    this.lastTick = FLOW.countdown;
    placeForServe(this.world, serverFor(this.score, this.rules));
  }

  /** A fresh match with the same settings. The old one fades out for a moment. */
  restart() {
    if (this.phase === "restarting") return;
    this.go("restarting");
  }
  private reset() {
    this.world = newWorld();
    this.applyBotSpeeds();
    this.score = newScore(0);
    this.stats = this.freshStats();
    this.winner = null;
    this.rally = 0;
    this.combo = [0, 0];
    this.trail = [];
    this.effects = [];
    this.pointWinner = null;
    this.pending = { setWon: null, matchWon: null };
    for (const b of this.bots) b?.reset();
    this.clock = 0;
    this.acc = 0;
  }

  pause() {
    if (this.phase === "paused" || this.phase === "idle" || this.phase === "restarting") return;
    if (this.phase === "matchComplete") return;
    this.pausedFrom = this.phase;
    this.go("paused");
    this.emit({ type: "pause" });
  }
  resume() {
    if (this.phase !== "paused") return;
    const back = this.pausedFrom;
    this.go(back);
    // A moment to get the fingers back on the screen before the ball moves again.
    if (back === "rally") this.grace = 1;
    this.emit({ type: "resume" });
  }

  /** Where the finger or the keyboard wants this player's paddle. Ignored for computer players. */
  setTarget(p: Player, x: number) {
    if (this.bots[p]) return;
    if (this.mode === "practice" && p === 1) return;
    this.world.paddles[p].target = x;
  }
  /** Nudges the target by `dx` (keyboard play). */
  nudge(p: Player, dx: number) {
    this.setTarget(p, this.world.paddles[p].target + dx);
  }

  /** Moves the match on by `dt` seconds. Safe to call with any dt; large gaps are cut short. */
  advance(dt: number) {
    if (!(dt > 0)) return; // zero, negative or not a number
    if (this.phase === "idle" || this.phase === "paused" || this.phase === "matchComplete") {
      if (this.phase === "matchComplete") this.phaseT += Math.min(dt, 0.1);
      return;
    }
    this.acc += Math.min(Math.max(dt, 0), P.step * P.maxSteps);
    while (this.acc >= P.step) {
      this.acc -= P.step;
      this.tick(P.step);
      if ((this.phase as Phase) === "paused" || (this.phase as Phase) === "matchComplete") break;
    }
  }

  private tick(dt: number) {
    this.clock += dt;
    this.phaseT += dt;
    this.stepCount++;
    if (this.phase === "rally") this.stats.seconds += dt;

    // Computer players choose a target every step.
    for (const p of [0, 1] as const) {
      const bot = this.bots[p];
      if (bot)
        this.world.paddles[p].target = bot.update(
          this.clock,
          this.world,
          this.world.paddles[p === 0 ? 1 : 0].x,
        );
    }

    switch (this.phase) {
      case "restarting":
        this.moveOnly(dt);
        if (this.phaseT >= FLOW.restart) {
          this.reset();
          this.beginCountdown();
        }
        break;
      case "countdown": {
        this.moveOnly(dt);
        placeForServe(this.world, serverFor(this.score, this.rules));
        const n = FLOW.countdown - Math.floor(this.phaseT / FLOW.countdownStep);
        if (n < this.lastTick && n > 0) {
          this.lastTick = n;
          this.emit({ type: "tick", n });
        }
        if (this.phaseT >= FLOW.countdown * FLOW.countdownStep) this.beginServe();
        break;
      }
      case "serve": {
        this.moveOnly(dt);
        const s = serverFor(this.score, this.rules);
        placeForServe(this.world, s);
        if (this.phaseT >= FLOW.serveDelay) {
          serve(this.world, s, this.rnd() * 2 - 1, this.speedScale);
          this.rally = 0;
          this.combo = [0, 0];
          this.trail = [];
          this.go("rally");
          this.emit({ type: "serve", server: s });
        }
        break;
      }
      case "rally":
        if (this.grace > 0) {
          this.grace -= dt;
          this.moveOnly(dt);
          break;
        }
        this.rallyStep(dt);
        break;
      case "point":
        this.moveOnly(dt);
        if (this.phaseT >= FLOW.pointHold) {
          if (this.pending.matchWon !== null) {
            this.winner = this.pending.matchWon;
            this.go("matchComplete");
            this.emit({ type: "matchEnd", winner: this.winner });
          } else if (this.pending.setWon !== null) {
            this.go("setComplete");
            this.emit({ type: "setEnd", winner: this.pending.setWon });
          } else this.beginServe();
        }
        break;
      case "setComplete":
        this.moveOnly(dt);
        if (this.phaseT >= FLOW.setHold) this.beginCountdown();
        break;
      default:
        break;
    }
  }

  private moveOnly(dt: number) {
    // Paddles still follow fingers between points; the ball does not move.
    for (const p of this.world.paddles) movePaddle(p, dt);
  }

  private beginServe() {
    const s = serverFor(this.score, this.rules);
    placeForServe(this.world, s);
    this.go("serve");
    const mp = matchPointFor(this.score, this.rules);
    if (mp !== null) this.emit({ type: "matchPoint", player: mp });
  }

  private rallyStep(dt: number) {
    const ev: StepEvent[] = [];
    step(this.world, dt, ev, this.speedScale, this.wall);
    if (this.stepCount % 2 === 0) {
      this.trail.push({ x: this.world.ball.x, y: this.world.ball.y });
      if (this.trail.length > TRAIL) this.trail.shift();
    }
    for (const e of ev) {
      if (e.type === "wall") {
        this.effects.push({
          kind: "wall",
          x: this.world.ball.x,
          y: this.world.ball.y,
          at: this.clock,
        });
        this.emit({ type: "wall" });
      } else if (e.type === "hit") {
        this.onHit(e.hit);
      } else if (e.type === "out") {
        this.onOut(e.loser);
        return;
      }
    }
  }

  private onHit(h: Hit) {
    this.rally++;
    const ps = this.stats.players[h.player];
    ps.hits++;
    if (h.perfect) {
      ps.perfect++;
      this.combo[h.player]++;
      ps.maxCombo = Math.max(ps.maxCombo, this.combo[h.player]);
    } else this.combo[h.player] = 0;
    if (h.smash) ps.smashes++;
    ps.maxSpeed = Math.max(ps.maxSpeed, h.speed);
    this.stats.longestRally = Math.max(this.stats.longestRally, this.rally);
    this.effects.push({
      kind: "hit",
      x: this.world.ball.x,
      y: this.world.ball.y,
      at: this.clock,
      hit: h,
    });
    this.emit({ type: "hit", hit: h, rally: this.rally, combo: this.combo[h.player] });
    if ((FLOW.milestones as readonly number[]).includes(this.rally)) {
      this.emit({ type: "milestone", rally: this.rally });
    }
  }

  private onOut(loser: Player) {
    this.stats.rallies++;
    const rally = this.rally;
    if (this.mode === "practice") {
      // No score: the rally just ends and a new ball is served.
      this.pointWinner = null;
      this.pending = { setWon: null, matchWon: null };
      this.go("point");
      this.emit({ type: "point", winner: null, rally });
      return;
    }
    const winner: Player = loser === 0 ? 1 : 0;
    const r = awardPoint(this.score, this.rules, winner);
    this.stats.players[winner].points++;
    this.score = r.score;
    this.pointWinner = winner;
    this.pending = { setWon: r.setWon, matchWon: r.matchWon };
    this.go("point");
    this.emit({ type: "point", winner, rally });
  }

  /** Where everything is right now, for the renderer. */
  view(): View {
    const b = this.world.ball;
    const phase = this.phase === "paused" ? this.pausedFrom : this.phase;
    const count =
      phase === "countdown"
        ? Math.max(1, FLOW.countdown - Math.floor(this.phaseT / FLOW.countdownStep))
        : 0;
    const mp = this.mode === "practice" ? null : matchPointFor(this.score, this.rules);
    return {
      phase: this.phase,
      ball: {
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        spin: b.spin,
        visible: phase !== "idle" && phase !== "restarting",
      },
      paddles: [this.world.paddles[0].x, this.world.paddles[1].x],
      score: this.score,
      server: serverFor(this.score, this.rules),
      count,
      trail: this.trail,
      rally: this.rally,
      speed: Math.min(1, speedOf(b) / (P.maxSpeed * this.speedScale)),
      effects: this.effects
        .filter((f) => this.clock - f.at < 0.55)
        .map((f) => ({
          kind: f.kind,
          x: f.x,
          y: f.y,
          age: this.clock - f.at,
          player: f.hit?.player ?? null,
          perfect: f.hit?.perfect ?? false,
          smash: f.hit?.smash ?? false,
        })),
      pointWinner: this.pointWinner,
      matchPoint: mp,
      deuce: this.mode !== "practice" && isDeuce(this.score, this.rules),
      winner: this.winner,
      phaseTime: this.phaseT,
      mode: this.mode,
    };
  }
}
