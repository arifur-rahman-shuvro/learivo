import {
  BATSMAN,
  BOWLER,
  HOLD_MS,
  KEEPER,
  type Difficulty,
  type ModeId,
  type Rnd,
  type Vec,
} from "./config.ts";
import { fieldersFor, missOutcome, resolveShot, rollDistAt, type Outcome } from "./fielding.ts";
import { applyOutcome, emptyTally, isOver, targetFor, type Tally } from "./match.ts";
import { makeShot } from "./shot.ts";
import { missWindowMs, newDelivery, type Delivery } from "./timing.ts";

/**
 * The game's state machine. It owns the rules of a match and every timing, and knows nothing about the
 * screen: a renderer asks `view()` what to draw. Time and dice are passed in, so tests can drive it exactly.
 *
 *   ready    the bowler runs in            (spec: READY)
 *   bowling  the ball is on its way        (BOWLING)
 *   swung    the bat is moving, ball not yet at the bat
 *   play     ball off the bat, fielders chase (BALL_IN_PLAY + SHOT_ANIMATION)
 *   result   the outcome is on screen; a wicket stays here a little longer (RESULT, WICKET)
 *   paused   frozen                        (PAUSED)
 *   over     the innings has ended         (GAME_OVER)
 */
export type Phase = "ready" | "bowling" | "swung" | "play" | "result" | "paused" | "over";
export type GameEvent = "deliver" | "swing" | "hit" | "four" | "six" | "wicket" | "runs" | "over";

export interface EngineOptions {
  mode: ModeId;
  difficulty: Difficulty;
  now?: () => number;
  rnd?: Rnd;
  onEvent?: (e: GameEvent, outcome: Outcome | null) => void;
}

/** A swing that comes through takes this long to complete, in ms. */
export const SWING_MS = 220;
/** How long the miss / bowled animation plays, in ms. */
export const MISS_MS = 900;
/** The ball leaves the bowler's hand this far behind the crease for the run-up picture. */
const RUN_UP_LEN = 0.22;
/** Where the stumps stand, just behind the batter. */
const STUMPS_Y = 0.4;

export interface View {
  phase: Phase;
  ball: { x: number; y: number; h: number; visible: boolean };
  bowler: Vec;
  /** The ball has left the bowler's hand. */
  released: boolean;
  swing: number;
  fielders: Vec[];
  stumpsDown: number;
  outcome: Outcome | null;
  delivery: Delivery;
  tally: Tally;
  /** ms since the shot left the bat (0 before that). */
  sincePlay: number;
  /** ms since the result appeared (0 before that). */
  sinceResult: number;
  /** ms since the bowler started his run-up (0 once the ball is bowled). */
  sinceReady: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class CricketEngine {
  readonly mode: ModeId;
  readonly difficulty: Difficulty;
  /** Runs to beat in Target Chase, otherwise null. */
  readonly target: number | null;
  phase: Phase = "ready";
  tally: Tally = emptyTally();
  delivery: Delivery;
  outcome: Outcome | null = null;
  /** How far from perfect the last swing was (negative = early); null when the bat was not swung. */
  offsetMs: number | null = null;
  /** Goes up on every change a menu or score board needs to hear about. */
  version = 0;

  private readonly clock: () => number;
  private readonly rnd: Rnd;
  private readonly onEvent?: (e: GameEvent, outcome: Outcome | null) => void;
  private readonly listeners = new Set<() => void>();
  private phaseStart = 0;
  private releaseAt = 0;
  private arriveAt = 0;
  private swingAt: number | null = null;
  private launchAt = 0;
  private playStart = 0;
  private playMs = 0;
  private resultAt = 0;
  private holdMs = 0;
  private pausedFrom: Phase = "ready";
  private pauseStart = 0;
  private readonly field;

  constructor(o: EngineOptions) {
    this.mode = o.mode;
    this.difficulty = o.difficulty;
    this.target = targetFor(o.mode, o.difficulty);
    this.clock = o.now ?? Date.now;
    this.rnd = o.rnd ?? Math.random;
    this.onEvent = o.onEvent;
    this.field = fieldersFor(o.difficulty);
    this.delivery = newDelivery(0, o.difficulty, this.rnd);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private changed() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }
  private event(e: GameEvent) {
    this.onEvent?.(e, this.outcome);
  }

  /** Starts (or restarts) the innings with a fresh tally. */
  start() {
    this.tally = emptyTally();
    this.beginReady(this.clock());
  }

  private beginReady(at: number) {
    this.delivery = newDelivery(this.tally.balls, this.difficulty, this.rnd);
    this.phase = "ready";
    this.phaseStart = at;
    this.swingAt = null;
    this.outcome = null;
    this.offsetMs = null;
    this.changed();
  }

  /** Moves the game on to the present moment. Called every frame; safe to call as often as you like. */
  update() {
    for (let guard = 0; guard < 8 && this.step(); guard++);
  }

  private step(): boolean {
    const t = this.clock();
    switch (this.phase) {
      case "ready": {
        const at = this.phaseStart + this.delivery.delayMs;
        if (t < at) return false;
        this.releaseAt = at;
        this.arriveAt = at + this.delivery.speedMs;
        this.phase = "bowling";
        this.event("deliver");
        this.changed();
        return true;
      }
      case "bowling":
        // Nobody swung and the ball has gone through.
        if (t < this.arriveAt + missWindowMs(this.difficulty) + 25) return false;
        this.outcome = missOutcome(false, this.rnd);
        this.launch(this.arriveAt + missWindowMs(this.difficulty) + 25);
        return true;
      case "swung":
        if (t < this.launchAt) return false;
        this.launch(this.launchAt);
        return true;
      case "play":
        if (t < this.playStart + this.playMs) return false;
        this.finishBall(this.playStart + this.playMs);
        return true;
      case "result":
        if (t < this.resultAt + this.holdMs) return false;
        this.afterResult(this.resultAt + this.holdMs);
        return true;
      default:
        return false;
    }
  }

  /**
   * The player taps. `aim` is where on the screen, from -1 (far left) to 1 (far right). Only counts while
   * the ball is on its way and only once per ball; everything else is ignored.
   */
  swing(aim = 0): boolean {
    if (this.phase !== "bowling") return false;
    const t = this.clock();
    const offset = t - this.arriveAt;
    const shot = makeShot(offset, aim, this.delivery, this.difficulty, this.rnd);
    this.offsetMs = offset;
    this.swingAt = t;
    this.outcome = shot
      ? resolveShot(shot, this.difficulty, this.rnd)
      : missOutcome(true, this.rnd);
    // An early swing connects when the ball arrives; a late one connects as it goes by.
    this.launchAt = Math.max(t, this.arriveAt);
    this.phase = "swung";
    this.event("swing");
    this.changed();
    this.update();
    return true;
  }

  private launch(at: number) {
    this.phase = "play";
    this.playStart = at;
    const f = this.outcome?.flight;
    this.playMs = f ? f.duration * 1000 : MISS_MS;
    this.event("hit");
    this.changed();
  }

  private finishBall(at: number) {
    const o = this.outcome!;
    this.tally = applyOutcome(this.tally, o);
    this.phase = "result";
    this.resultAt = at;
    this.holdMs = o.out ? HOLD_MS.wicket : o.runs >= 4 ? HOLD_MS.boundary : HOLD_MS.normal;
    this.event(o.out ? "wicket" : o.kind === "six" ? "six" : o.kind === "four" ? "four" : "runs");
    this.changed();
  }

  private afterResult(at: number) {
    if (isOver(this.tally, this.mode, this.target)) {
      this.phase = "over";
      this.event("over");
      this.changed();
    } else {
      this.beginReady(at);
    }
  }

  /** Freezes the game (button, Escape key, or the tab being hidden). */
  pause() {
    if (this.phase === "paused" || this.phase === "over") return;
    this.pausedFrom = this.phase;
    this.pauseStart = this.clock();
    this.phase = "paused";
    this.changed();
  }

  /**
   * Carries on. A ball that was still on its way is bowled again and not counted, so a pause can never
   * cost or win anything; every other moment simply continues where it stopped.
   */
  resume() {
    if (this.phase !== "paused") return;
    const now = this.clock();
    const gap = now - this.pauseStart;
    if (this.pausedFrom === "bowling" || this.pausedFrom === "swung") {
      this.beginReady(now);
      return;
    }
    this.phaseStart += gap;
    this.playStart += gap;
    this.resultAt += gap;
    this.launchAt += gap;
    if (this.swingAt !== null) this.swingAt += gap;
    this.phase = this.pausedFrom;
    this.changed();
  }

  /** Where everything is right now, for the renderer. */
  view(): View {
    const t = this.phase === "paused" ? this.pauseStart : this.clock();
    const phase = this.phase === "paused" ? this.pausedFrom : this.phase;
    const d = this.delivery;
    const o = this.outcome;
    const ball = { x: 0, y: 0, h: 0, visible: false };
    const bowler = { x: BOWLER.x, y: BOWLER.y };
    let released = false;
    let sincePlay = 0;

    if (phase === "ready") {
      const r = clamp01((t - this.phaseStart) / d.delayMs);
      bowler.y = lerp(BOWLER.y - RUN_UP_LEN, BOWLER.y, r);
    } else {
      released = true;
    }
    if (phase === "bowling" || phase === "swung") {
      const p = clamp01((t - this.releaseAt) / d.speedMs);
      ball.visible = true;
      ball.y = lerp(BOWLER.y, BATSMAN.y, p);
      ball.x = d.swing * 0.07 * Math.sin(Math.PI * p);
      const bounce = 0.65;
      ball.h =
        p < bounce
          ? 0.35 * Math.sin((Math.PI * p) / bounce)
          : 0.2 * Math.sin((Math.PI * (p - bounce)) / (1 - bounce));
      // A ball that nobody is going to hit carries on past the bat.
      const passing = phase === "bowling" || (phase === "swung" && o?.timing === "miss");
      if (p >= 1 && passing) {
        ball.x = 0;
        ball.h = 0;
        ball.y = lerp(BATSMAN.y, STUMPS_Y, clamp01((t - this.arriveAt) / 300));
      }
    }
    const fielders: Vec[] = this.field.map((f) => ({ x: f.pos.x, y: f.pos.y }));
    let stumpsDown = 0;
    if (phase === "play" || phase === "result" || phase === "over") {
      sincePlay = Math.max(0, t - this.playStart);
      const tt = sincePlay / 1000;
      const fl = o?.flight;
      ball.visible = true;
      if (fl) {
        if (fl.carry > 0 && tt < fl.airTime) {
          const u = tt / fl.airTime;
          ball.x = fl.start.x + fl.dir.x * fl.carry * u;
          ball.y = fl.start.y + fl.dir.y * fl.carry * u;
          ball.h = 4 * u * (1 - u) * (0.3 + 0.35 * fl.carry);
        } else {
          const s = rollDistAt(fl.rollDist, fl.rollT, Math.min(tt - fl.airTime, fl.rollTime));
          ball.x = fl.rollFrom.x + fl.dir.x * s;
          ball.y = fl.rollFrom.y + fl.dir.y * s;
          if (fl.rollDist === 0) {
            ball.x = fl.stop.x;
            ball.y = fl.stop.y;
          }
        }
        if (fl.fielder !== null) {
          const base = this.field[fl.fielder]!.pos;
          const startT = fl.carry > 0 && !fl.caught && !fl.dropped ? fl.airTime : 0;
          const target = fl.caught || fl.dropped ? fl.rollFrom : fl.stop;
          const u = clamp01((tt - startT) / Math.max(0.01, fl.fielderTime));
          const e = 1 - (1 - u) * (1 - u);
          fielders[fl.fielder] = { x: lerp(base.x, target.x, e), y: lerp(base.y, target.y, e) };
        }
      } else {
        // Missed: the ball carries on to the stumps (bowled) or into the keeper's gloves.
        const u = clamp01(tt / 0.3);
        const end = o?.kind === "bowled" ? STUMPS_Y : KEEPER.y;
        ball.x = 0;
        ball.y = this.offsetMs === null ? end : lerp(BATSMAN.y, end, u);
        if (o?.kind === "bowled") stumpsDown = clamp01((sincePlay - 120) / 300);
      }
    }
    const sinceResult = phase === "result" || phase === "over" ? Math.max(0, t - this.resultAt) : 0;
    const sinceReady = phase === "ready" ? Math.max(0, t - this.phaseStart) : 0;
    const swing = this.swingAt === null ? 0 : clamp01((t - this.swingAt) / SWING_MS);
    return {
      phase: this.phase,
      ball,
      bowler,
      released,
      swing,
      fielders,
      stumpsDown,
      outcome: o,
      delivery: d,
      tally: this.tally,
      sincePlay,
      sinceResult,
      sinceReady,
    };
  }
}
