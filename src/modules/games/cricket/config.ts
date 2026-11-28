/*
 * Mini cricket: every number that tunes the feel lives here.
 *
 * The ground is a circle of radius 1 (the rope). x grows to the right, y grows DOWN the screen.
 * The bowler is at the top, the batter near the bottom. Time is in milliseconds unless a name ends in
 * "Sec". Nothing in this file touches the screen, so all of it can be unit tested.
 */

export interface Vec {
  x: number;
  y: number;
}
export type Rnd = () => number;

export type Difficulty = "easy" | "medium" | "hard";
export type DeliveryType = "normal" | "fast" | "slow" | "swing";
export type ModeId = "quick" | "six" | "wickets" | "chase";

export const BATSMAN: Vec = { x: 0, y: 0.26 };
export const BOWLER: Vec = { x: 0, y: -0.42 };
export const KEEPER: Vec = { x: 0, y: 0.42 };

/** Up to seven fielders, in the order they are added as the difficulty rises. */
export const FIELD_SPOTS: readonly Vec[] = [
  { x: 0.42, y: -0.32 }, // mid-off
  { x: -0.42, y: -0.32 }, // mid-on
  { x: 0.7, y: 0.05 }, // point
  { x: -0.7, y: 0.12 }, // square leg
  { x: 0.55, y: -0.72 }, // long-off
  { x: -0.55, y: -0.72 }, // long-on
  { x: 0.5, y: 0.7 }, // third man
];

/** Timing windows from the brief, in ms either side of the perfect moment, at "medium". */
export const TIMING = { perfect: 80, good: 160, average: 250, miss: 380 } as const;
/** Inside this many ms (scaled like the rest) a late or early swing still goes straight and high. */
export const SWEET_MS = 30;

export interface DifficultyCfg {
  label: string;
  blurb: string;
  /** Time from release to the ball reaching the bat. */
  speedMs: number;
  /** Multiplies every timing window: bigger is more forgiving. */
  windowScale: number;
  fielders: number;
  /** Fielder run speed (ground units per second), reaction delay (seconds) and catch skill (0 to 1). */
  fielderSpeed: number;
  reaction: number;
  catching: number;
  weights: Record<DeliveryType, number>;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyCfg> = {
  easy: {
    label: "Easy",
    blurb: "Slow balls, wide timing, 5 fielders",
    speedMs: 1550,
    windowScale: 1.3,
    fielders: 5,
    fielderSpeed: 0.4,
    reaction: 0.35,
    catching: 0.5,
    weights: { normal: 0.7, slow: 0.2, fast: 0.1, swing: 0 },
  },
  medium: {
    label: "Medium",
    blurb: "Mixed speeds, normal timing, 6 fielders",
    speedMs: 1300,
    windowScale: 1,
    fielders: 6,
    fielderSpeed: 0.5,
    reaction: 0.25,
    catching: 0.62,
    weights: { normal: 0.45, slow: 0.2, fast: 0.2, swing: 0.15 },
  },
  hard: {
    label: "Hard",
    blurb: "Fast balls and swing, tight timing, 7 fielders",
    speedMs: 1050,
    windowScale: 0.8,
    fielders: 7,
    fielderSpeed: 0.62,
    reaction: 0.15,
    catching: 0.78,
    weights: { normal: 0.3, slow: 0.1, fast: 0.3, swing: 0.3 },
  },
};

/** Each delivery type changes the speed of the ball. */
export const SPEED_FACTOR: Record<DeliveryType, number> = {
  normal: 1,
  fast: 0.78,
  slow: 1.3,
  swing: 1,
};
/** The game gets a little quicker with every ball faced, down to this share of the base speed. */
export const RAMP_MS_PER_BALL = 15;
export const RAMP_FLOOR = 0.72;
export const MIN_SPEED_MS = 560;
/** How long the bowler runs in before the ball is released. */
export const RUN_UP_MS = [700, 600] as const; // 700 + up to 600

export interface ModeCfg {
  id: ModeId;
  label: string;
  blurb: string;
  wickets: number;
  /** Legal deliveries; Infinity means "until out". */
  balls: number;
}

export const MODES: Record<ModeId, ModeCfg> = {
  quick: {
    id: "quick",
    label: "Quick Play",
    blurb: "One wicket. Last as long as you can.",
    wickets: 1,
    balls: Infinity,
  },
  six: {
    id: "six",
    label: "6-Ball Challenge",
    blurb: "Six balls, two wickets. Score big.",
    wickets: 2,
    balls: 6,
  },
  wickets: {
    id: "wickets",
    label: "10-Wicket Challenge",
    blurb: "Ten wickets, up to 10 overs.",
    wickets: 10,
    balls: 60,
  },
  chase: {
    id: "chase",
    label: "Target Chase",
    blurb: "Reach the target in two overs. Three wickets.",
    wickets: 3,
    balls: 12,
  },
};
export const MODE_ORDER: readonly ModeId[] = ["quick", "six", "wickets", "chase"];

/** Runs to reach to win Target Chase. A steady player (timing within about 110 ms) wins about half of the time. */
export const CHASE_TARGET: Record<Difficulty, number> = { easy: 40, medium: 36, hard: 32 };
export const DIFFICULTY_ORDER: readonly Difficulty[] = ["easy", "medium", "hard"];

/** How the shot comes off the bat. */
export const SHOT = {
  /** Degrees of direction per ms of early (to the left) or late (to the right). */
  degPerMs: 0.22,
  maxAngle: 65,
  /** Most a tap at the far left or right edge can steer the ball, in degrees. */
  aimDeg: 12,
  swingBiasDeg: 5,
  /** Power by distance from perfect (ms at "medium"), joined by straight lines. 1 = full power. */
  powerCurve: [
    [0, 1],
    [30, 1],
    [80, 0.86],
    [160, 0.7],
    [250, 0.45],
    [380, 0.2],
  ] as readonly (readonly [number, number])[],
} as const;

/** Ball and fielding physics, in ground units and seconds. */
export const PHYSICS = {
  airCarry: [0.2, 1.15] as const, // carry = a + b * power
  airTime: [0.45, 0.45] as const, // seconds = a + b * carry
  groundDist: [0.15, 1.45] as const, // distance = a + b * power
  rollTime: [0.35, 0.5] as const, // seconds to stop = a + b * distance
  looseRoll: [0.12, 0.45] as const, // roll after an air ball lands: a + b * power
  fielderRadius: 0.07,
  /** A fielder needs a moment to judge a high ball before he starts to move. */
  airJudge: 0.25,
  catchPenalty: 0.35, // a fielder who only just arrives is less sure
  throwSpeed: 2.2,
  throwBase: 0.3,
  runBase: 0.3,
  runTime: 0.8,
  maxRuns: 3,
  missBowled: 0.55,
} as const;

/** How long the result stays on screen before the next ball, in ms. */
export const HOLD_MS = { normal: 1100, boundary: 1300, wicket: 1700 } as const;
