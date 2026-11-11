import { themeList, getTokens, resolveMode } from "./registry.ts";
import type { Mode, ThemeDefinition } from "./types";

const kebab = (s: string) => s.replace(/[A-Z0-9]/g, (c) => "-" + c.toLowerCase());

function declarations(theme: ThemeDefinition, mode: Mode): string {
  const { colors, style } = getTokens(theme, mode);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(colors)) lines.push(`--lv-${kebab(k)}:${v};`);
  for (const [k, v] of Object.entries(style)) lines.push(`--lv-${kebab(k)}:${v};`);
  lines.push(`color-scheme:${resolveMode(theme, mode)};`);
  return lines.join("");
}

/**
 * Compiles every registered theme and mode to CSS custom properties under
 * `[data-theme][data-mode]`. A mode a theme does not support falls back to its default mode.
 */
export function themeToCss(): string {
  const blocks: string[] = [];
  for (const theme of themeList) {
    for (const mode of ["light", "dark"] as const) {
      blocks.push(`[data-theme="${theme.id}"][data-mode="${mode}"]{${declarations(theme, mode)}}`);
    }
  }
  return blocks.join("\n");
}
