import type { StyleTokens, ThemeDefinition } from "../types.ts";

/**
 * Pure black for OLED phones: the page itself is #000000, so those pixels are switched off,
 * which saves battery and is easy on the eyes at night. Surfaces step up in very dark greys so
 * cards still read as cards. No gradients and no glow, on purpose.
 */
const style: StyleTokens = {
  fontHeading: '"Inter Variable", system-ui, sans-serif',
  fontBody: '"Inter Variable", system-ui, sans-serif',
  fontMono: '"JetBrains Mono Variable", ui-monospace, monospace',
  radiusControl: "10px",
  radiusCard: "16px",
  radiusPill: "999px",
  borderWidth: "1px",
  shadowCard: "none",
  shadowRaised: "0 0 0 1px rgb(255 255 255 / 0.08)",
  buttonShadow: "none",
  buttonShadowHover: "none",
  surfaceTexture: "none",
  pageBackground: "none",
  ringCap: "round",
  ringGlow: "none",
  motionFast: "120ms",
  motionBase: "220ms",
  ease: "cubic-bezier(0.2, 0.7, 0.2, 1)",
};

export const amoledTheme: ThemeDefinition = {
  id: "amoled",
  name: "AMOLED",
  description: "Pure black. Saves battery on OLED screens. Dark only.",
  defaultMode: "dark",
  modes: {
    dark: {
      style,
      colors: {
        bg: "#000000",
        surface1: "#0B0B0D",
        surface2: "#141417",
        surface3: "#1E1E22",
        text: "#F5F5F7",
        textMuted: "#A3A3AD",
        accent: "#38BDF8",
        accentContrast: "#00131C",
        border: "#2A2A30",
        borderStrong: "#6B6B76",
        focus: "#7DD3FC",
        success: "#4ADE80",
        warning: "#FBBF24",
        danger: "#F87171",
        chart1: "#38BDF8",
        chart2: "#A78BFA",
        chart3: "#FBBF24",
        chart4: "#FB7185",
      },
    },
  },
};
