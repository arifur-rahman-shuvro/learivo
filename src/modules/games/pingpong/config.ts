/*
 * Mini table tennis: every number that tunes the feel lives here (no other file has a magic number).
 *
 * The table is seen from above. x runs left to right from 0 to 1, y runs down from 0 to HEIGHT.
 * Player 0 is at the bottom, player 1 at the top. Speeds are table units per second. Nothing here
 * touches the screen, so all of it can be unit tested.
 */
export type Player = 0 | 1;
export type Rnd = () => number;
export type Mode = "ai" | "local" | "practice";
export type Level = "easy" | "normal" | "hard" | "expert";
export type PracticeSpeed = "slow" | "normal" | "fast";

export const WIDTH = 1;
export const HEIGHT = 1.6;

export const BALL_R = 0.028;
export const PADDLE = {
  halfW: 0.12,
  halfT: 0.016,
  /** Distance from the table edge to the paddle's centre line. */
  inset: 0.085,
  /** Fastest a paddle can travel (finger or AI), units per second. */
  maxSpeed: 3.4,
} as const;
export const PADDLE_Y: Record<Player, number> = { 0: HEIGHT - PADDLE.inset, 1: PADDLE.inset };

export const PHYSICS = {
  /** Fixed simulation step; the screen frame rate never changes the physics. */
  step: 1 / 120,
  /** Most steps run for one frame (a slow phone catches up, a hidden tab does not). */
  maxSteps: 12,
  serveSpeed: 1.15,
  /** Ball speed grows by this much on every hit, up to maxSpeed. */
  hitGain: 0.035,
  maxSpeed: 2.7,
  /** Largest angle the ball can leave the paddle at, in degrees from straight up the table. */
  maxAngle: 52,
  /** Extra angle from the paddle's own sideways speed (fraction of maxSpeed => degrees). */
  velAngle: 10,
  /** Hitting the ball near the middle of the paddle is a perfect hit. */
  perfectZone: 0.22,
  perfectBoost: 1.05,
  /** A paddle moving at least this fast (units/s) when it hits is a smash. */
  smashSpeed: 1.6,
  smashBoost: 1.12,
  wallBounce: 0.98,
  /** Sideways push on the ball from spin, and how quickly spin dies away. */
  spinCurve: 0.9,
  spinDecay: 0.55,
  spinFromVelocity: 0.35,
  spinFromOffset: 0.9,
  maxSpin: 1.6,
  /** The ball never flies flatter than this fraction of its speed along the table. */
  minForward: 0.55,
} as const;

/** How the match moves between points. Times in seconds. */
export const FLOW = {
  countdown: 3,
  countdownStep: 0.8,
  serveDelay: 0.75,
  pointHold: 1.15,
  setHold: 1.9,
  restart: 0.35,
  /** Pops up at these rally lengths. */
  milestones: [5, 10, 20, 30],
} as const;

export const PRACTICE: Record<PracticeSpeed, number> = { slow: 0.75, normal: 1, fast: 1.3 };

export interface AiCfg {
  label: string;
  blurb: string;
  /** The AI sees the ball this long ago (seconds). */
  reaction: number;
  /** How fast its paddle can move. */
  speed: number;
  /** Size of the random aiming error, in table units. */
  error: number;
  /** Chance per incoming ball that it misjudges badly. */
  mistake: number;
  /** 0 to 1: how much it tries to hit the ball away from the human. */
  placement: number;
  /** 0 to 1: how well it allows for spin and wall bounces when it predicts. */
  prediction: number;
}

export const LEVELS: Record<Level, AiCfg> = {
  easy: {
    label: "Easy",
    blurb: "Slow to react, often misses",
    reaction: 0.3,
    speed: 0.85,
    error: 0.1,
    mistake: 0.2,
    placement: 0,
    prediction: 0.5,
  },
  normal: {
    label: "Normal",
    blurb: "A fair rally partner",
    reaction: 0.2,
    speed: 1.35,
    error: 0.055,
    mistake: 0.09,
    placement: 0.35,
    prediction: 0.8,
  },
  hard: {
    label: "Hard",
    blurb: "Quick and aims away from you",
    reaction: 0.13,
    speed: 1.8,
    error: 0.035,
    mistake: 0.05,
    placement: 0.75,
    prediction: 1,
  },
  expert: {
    label: "Expert",
    blurb: "Rarely misses, plays the angles",
    reaction: 0.09,
    speed: 2.4,
    error: 0.018,
    mistake: 0.02,
    placement: 1,
    prediction: 1,
  },
};
export const LEVEL_ORDER: readonly Level[] = ["easy", "normal", "hard", "expert"];

export interface Rules {
  /** Points to win a set: 5, 7, 11 or 21. */
  target: 5 | 7 | 11 | 21;
  winBy: number;
  /** Sets in the match: 1, 3 or 5 (best of). */
  bestOf: 1 | 3 | 5;
}
export const DEFAULT_RULES: Rules = { target: 11, winBy: 2, bestOf: 1 };
export const TARGETS: readonly Rules["target"][] = [5, 7, 11, 21];
export const BEST_OF: readonly Rules["bestOf"][] = [1, 3, 5];

export interface Theme {
  label: string;
  bg: string;
  table: string;
  tableAlt: string;
  line: string;
  ball: string;
  p0: string;
  p1: string;
}
export const THEMES: Record<string, Theme> = {
  midnight: {
    label: "Midnight",
    bg: "#0d1426",
    table: "#1b3a8a",
    tableAlt: "#1f43a0",
    line: "#ffffff",
    ball: "#ffd23f",
    p0: "#ff6b6b",
    p1: "#2ec4b6",
  },
  forest: {
    label: "Forest",
    bg: "#0c1a14",
    table: "#1f6b46",
    tableAlt: "#247a50",
    line: "#f4f1e6",
    ball: "#ffffff",
    p0: "#ff9f1c",
    p1: "#a78bfa",
  },
  sunset: {
    label: "Sunset",
    bg: "#24121f",
    table: "#9a3b5b",
    tableAlt: "#ab4467",
    line: "#fff4e6",
    ball: "#fff07a",
    p0: "#4cc9f0",
    p1: "#b8f27a",
  },
};
export const THEME_ORDER = ["midnight", "forest", "sunset"] as const;
export type ThemeId = (typeof THEME_ORDER)[number];
