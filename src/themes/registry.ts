import { defaultTheme } from "./default/tokens.ts";
import { forestTheme } from "./forest/tokens.ts";
import { spaceTheme } from "./space/tokens.ts";
import type { Mode, ThemeDefinition, ThemeId, ThemeTokenSet } from "./types";

/**
 * Theme registry. To add a theme: create a folder with a `tokens.ts` that exports
 * a ThemeDefinition, add its id to `ThemeId`, and register it here.
 */
export const themes: Record<ThemeId, ThemeDefinition> = {
  default: defaultTheme,
  forest: forestTheme,
  space: spaceTheme,
};

export const themeList: ThemeDefinition[] = Object.values(themes);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in themes;
}

export function getTheme(id: string | null | undefined): ThemeDefinition {
  return isThemeId(id) ? themes[id] : defaultTheme;
}

export function supportedModes(theme: ThemeDefinition): Mode[] {
  return (["light", "dark"] as const).filter((m) => theme.modes[m] !== undefined);
}

/** Returns the requested mode if the theme supports it, otherwise the theme's default. */
export function resolveMode(theme: ThemeDefinition, requested: Mode): Mode {
  return theme.modes[requested] ? requested : theme.defaultMode;
}

export function getTokens(theme: ThemeDefinition, mode: Mode): ThemeTokenSet {
  const set = theme.modes[resolveMode(theme, mode)];
  if (!set) throw new Error(`Theme "${theme.id}" has no usable mode`);
  return set;
}
