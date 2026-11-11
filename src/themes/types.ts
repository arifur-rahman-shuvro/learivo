export type ThemeId = "default" | "forest" | "space";
export type Mode = "light" | "dark";
export type ModePreference = Mode | "system";

/** Colour tokens. Components may only use these semantic names. */
export interface ColorTokens {
  bg: string;
  surface1: string;
  surface2: string;
  surface3: string;
  text: string;
  textMuted: string;
  accent: string;
  /** Text or icon colour drawn on top of `accent`. */
  accentContrast: string;
  border: string;
  /** Border for interactive controls such as inputs (needs 3:1 contrast). */
  borderStrong: string;
  focus: string;
  success: string;
  warning: string;
  danger: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
}

/** Shape, type, depth and motion tokens (any CSS value). */
export interface StyleTokens {
  fontHeading: string;
  fontBody: string;
  fontMono: string;
  radiusControl: string;
  radiusCard: string;
  radiusPill: string;
  borderWidth: string;
  shadowCard: string;
  shadowRaised: string;
  buttonShadow: string;
  buttonShadowHover: string;
  /** Texture or pattern layered on card surfaces ("none" for flat). */
  surfaceTexture: string;
  /** Full-page background painted behind the app. */
  pageBackground: string;
  ringCap: "round" | "butt";
  ringGlow: string;
  motionFast: string;
  motionBase: string;
  ease: string;
}

export interface ThemeTokenSet {
  colors: ColorTokens;
  style: StyleTokens;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  /** Modes this theme supports. At least one is required. */
  modes: Partial<Record<Mode, ThemeTokenSet>>;
  defaultMode: Mode;
}
