import type { StyleTokens, ThemeDefinition } from "../types.ts";

const style: StyleTokens = {
  fontHeading: '"Space Grotesk Variable", system-ui, sans-serif',
  fontBody: '"Space Grotesk Variable", system-ui, sans-serif',
  fontMono: '"JetBrains Mono Variable", ui-monospace, monospace',
  radiusControl: "8px",
  radiusCard: "14px",
  radiusPill: "999px",
  borderWidth: "1px",
  shadowCard: "0 0 0 1px rgb(120 140 255 / 0.10), 0 8px 28px rgb(0 0 0 / 0.5)",
  shadowRaised: "0 0 0 1px rgb(140 160 255 / 0.18), 0 0 32px rgb(94 160 255 / 0.12), 0 16px 40px rgb(0 0 0 / 0.6)",
  buttonShadow: "0 0 14px rgb(34 211 238 / 0.35)",
  buttonShadowHover: "0 0 26px rgb(34 211 238 / 0.6)",
  surfaceTexture: "none",
  // Starfield built from radial gradients, layered over a nebula wash.
  pageBackground: [
    "radial-gradient(1.2px 1.2px at 12% 18%, rgb(255 255 255 / 0.9), transparent)",
    "radial-gradient(1px 1px at 28% 62%, rgb(255 255 255 / 0.7), transparent)",
    "radial-gradient(1.4px 1.4px at 46% 30%, rgb(200 220 255 / 0.9), transparent)",
    "radial-gradient(1px 1px at 63% 78%, rgb(255 255 255 / 0.6), transparent)",
    "radial-gradient(1.3px 1.3px at 81% 22%, rgb(255 255 255 / 0.8), transparent)",
    "radial-gradient(1px 1px at 90% 66%, rgb(190 200 255 / 0.7), transparent)",
    "radial-gradient(800px 520px at 85% -5%, rgb(139 92 246 / 0.28), transparent 65%)",
    "radial-gradient(700px 480px at 5% 105%, rgb(34 211 238 / 0.14), transparent 65%)",
  ].join(", "),
  ringCap: "butt",
  ringGlow: "drop-shadow(0 0 6px rgb(34 211 238 / 0.65))",
  motionFast: "100ms",
  motionBase: "200ms",
  ease: "cubic-bezier(0.16, 1, 0.3, 1)",
};

export const spaceTheme: ThemeDefinition = {
  id: "space",
  name: "Space",
  description: "Focused, futuristic and immersive. Dark only.",
  defaultMode: "dark",
  modes: {
    dark: {
      style,
      colors: {
        bg: "#070A1A",
        surface1: "#0E1330",
        surface2: "#151B42",
        surface3: "#1D2556",
        text: "#F1F4FF",
        textMuted: "#A9B3E0",
        accent: "#22D3EE",
        accentContrast: "#04121A",
        border: "#2A3370",
        borderStrong: "#6C7BD8",
        focus: "#C4B5FD",
        success: "#4ADE80",
        warning: "#FBBF24",
        danger: "#FB7185",
        chart1: "#22D3EE",
        chart2: "#A78BFA",
        chart3: "#FBBF24",
        chart4: "#FB7185",
      },
    },
  },
};
