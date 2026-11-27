import type { ComponentType } from "react";
import type { GameManifest } from "./registry.tsx";

/** What a finished round reports back. Nothing here is saved yet: see docs/GAMES.md, "Saving scores". */
export interface GameResult {
  /** The `id` from the game's manifest. */
  gameId: string;
  /** Points, for the game's own best-score list. Higher is better. */
  score: number;
  durationSeconds: number;
  /** Brain Gym games only: how many answers were right out of how many. */
  correct?: number;
  total?: number;
  /** ISO time the round ended. */
  finishedAt: string;
}

/** The props every playable game screen receives. A game never navigates by itself. */
export interface GameProps {
  /** Leave the game and return to its list. */
  onExit: () => void;
  /** Report a finished round once, then show the game's own result screen. */
  onFinish: (result: GameResult) => void;
}

/** A game that really plays: the manifest plus a lazy loader, so the game code is a separate chunk. */
export interface PlayableGame extends GameManifest {
  status: "ready";
  load: () => Promise<{ default: ComponentType<GameProps> }>;
}
