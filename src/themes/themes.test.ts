import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { themeToCss } from "./css";
import { getTheme, getTokens, resolveMode, supportedModes, themeList } from "./registry";

const modes = themeList.flatMap((theme) =>
  supportedModes(theme).map((mode) => ({ theme, mode, label: `${theme.id}/${mode}` })),
);

describe("theme registry", () => {
  it("registers the three launch themes", () => {
    expect(themeList.map((t) => t.id).sort()).toEqual(["default", "forest", "space"]);
  });

  it("every theme supports at least one mode and its default mode exists", () => {
    for (const theme of themeList) {
      expect(supportedModes(theme).length).toBeGreaterThan(0);
      expect(theme.modes[theme.defaultMode]).toBeDefined();
    }
  });

  it("falls back to the default theme for unknown ids", () => {
    expect(getTheme("nope").id).toBe("default");
    expect(getTheme(null).id).toBe("default");
  });

  it("falls back to a supported mode (Space has no light mode)", () => {
    expect(resolveMode(getTheme("space"), "light")).toBe("dark");
    expect(resolveMode(getTheme("forest"), "light")).toBe("light");
  });

  it("every theme and mode defines the same token keys", () => {
    const ref = getTokens(getTheme("default"), "light");
    for (const { theme, mode } of modes) {
      const t = getTokens(theme, mode);
      expect(Object.keys(t.colors).sort()).toEqual(Object.keys(ref.colors).sort());
      expect(Object.keys(t.style).sort()).toEqual(Object.keys(ref.style).sort());
    }
  });
});

describe("accessibility contrast (WCAG AA)", () => {
  for (const { theme, mode, label } of modes) {
    const c = getTokens(theme, mode).colors;
    const surfaces = [c.bg, c.surface1, c.surface2, c.surface3];

    it(`${label}: body text is at least 4.5:1 on every surface`, () => {
      for (const s of surfaces) expect(contrastRatio(c.text, s)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${label}: muted text is at least 4.5:1 on bg, surface1 and surface2`, () => {
      for (const s of [c.bg, c.surface1, c.surface2]) {
        expect(contrastRatio(c.textMuted, s)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${label}: text on accent is at least 4.5:1`, () => {
      expect(contrastRatio(c.accentContrast, c.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${label}: accent is at least 3:1 on bg and surface1`, () => {
      for (const s of [c.bg, c.surface1]) expect(contrastRatio(c.accent, s)).toBeGreaterThanOrEqual(3);
    });

    it(`${label}: control borders and focus ring are at least 3:1 on bg and surface1`, () => {
      for (const s of [c.bg, c.surface1]) {
        expect(contrastRatio(c.borderStrong, s)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(c.focus, s)).toBeGreaterThanOrEqual(3);
      }
    });

    it(`${label}: status colours are at least 4.5:1 as text on surface1`, () => {
      for (const s of [c.success, c.warning, c.danger]) {
        expect(contrastRatio(s, c.surface1)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${label}: chart colours are at least 3:1 on surface1`, () => {
      for (const s of [c.chart1, c.chart2, c.chart3, c.chart4]) {
        expect(contrastRatio(s, c.surface1)).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

describe("theme CSS generation", () => {
  const css = themeToCss();

  it("emits a block for every theme and mode, including fallbacks", () => {
    for (const theme of themeList) {
      for (const mode of ["light", "dark"]) {
        expect(css).toContain(`[data-theme="${theme.id}"][data-mode="${mode}"]`);
      }
    }
  });

  it("emits colour and style variables", () => {
    expect(css).toContain("--lv-bg:#F8F9FC;");
    expect(css).toContain("--lv-font-heading:");
    expect(css).toContain("--lv-surface-1:");
  });
});
