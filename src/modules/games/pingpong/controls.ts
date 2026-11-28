import { PADDLE, WIDTH, type Player } from "./config.ts";
import { clampX } from "./physics.ts";

export type Layout = "single" | "split";

/**
 * Keeps track of which finger drives which paddle. In "split" (two players) the lower half of the
 * screen belongs to player 0 and the upper half to player 1; a finger keeps its paddle until it lifts,
 * so a finger that wanders across the middle never takes the other paddle, and two fingers on the same
 * half never fight over one paddle. In "single" every finger drives player 0.
 * Positions are 0 to 1 across and down the table picture. No DOM in here, so it is easy to test.
 */
export class Touches {
  private owner = new Map<number, Player>();
  private held: [number | null, number | null] = [null, null];
  /** 1 is a finger exactly as wide as the table; larger lets a short drag cover the whole table. */
  sensitivity = 1.15;

  constructor(readonly layout: Layout) {}

  /** The paddle x a finger at `nx` asks for. */
  aim(nx: number): number {
    return clampX(WIDTH / 2 + (nx - 0.5) * WIDTH * this.sensitivity);
  }

  /** A finger lands. Returns the player it drives and the x to aim for, or null if it was ignored. */
  down(id: number, nx: number, ny: number): { player: Player; x: number } | null {
    if (this.owner.has(id)) return null;
    const player: Player = this.layout === "single" || ny >= 0.5 ? 0 : 1;
    if (this.held[player] !== null) return null;
    this.owner.set(id, player);
    this.held[player] = id;
    return { player, x: this.aim(nx) };
  }

  move(id: number, nx: number): { player: Player; x: number } | null {
    const player = this.owner.get(id);
    return player === undefined ? null : { player, x: this.aim(nx) };
  }

  /** The finger lifted or the touch was cancelled. Returns the player it was driving. */
  up(id: number): Player | null {
    const player = this.owner.get(id);
    if (player === undefined) return null;
    this.owner.delete(id);
    this.held[player] = null;
    return player;
  }

  /** Forgets every finger (for pause, losing focus, resize). */
  clear() {
    this.owner.clear();
    this.held = [null, null];
  }

  get active(): number {
    return this.owner.size;
  }
}

export const KEY_SPEED = PADDLE.maxSpeed * 0.7;
