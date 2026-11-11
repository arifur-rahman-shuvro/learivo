import type { StyleTokens, ThemeDefinition } from "../types.ts";

// Subtle paper grain, generated in code (no image file).
const grain =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.1  0 0 0 0.07 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const style: StyleTokens = {
  fontHeading: '"Fraunces Variable", Georgia, serif',
  fontBody: '"Nunito Sans Variable", system-ui, sans-serif',
  fontMono: '"JetBrains Mono Variable", ui-monospace, monospace',
  radiusControl: "14px",
  radiusCard: "22px",
  radiusPill: "999px",
  borderWidth: "1px",
  shadowCard: "0 2px 0 rgb(80 66 30 / 0.06), 0 8px 22px rgb(60 70 30 / 0.10)",
  shadowRaised: "0 3px 0 rgb(80 66 30 / 0.08), 0 16px 36px rgb(60 70 30 / 0.16)",
  buttonShadow: "0 2px 0 rgb(20 60 30 / 0.45)",
  buttonShadowHover: "0 4px 0 rgb(20 60 30 / 0.45)",
  surfaceTexture: grain,
  pageBackground:
    "radial-gradient(1000px 520px at 50% -12%, rgb(212 168 67 / 0.20), transparent 62%), linear-gradient(180deg, rgb(47 107 58 / 0.10), transparent 40%)",
  ringCap: "round",
  ringGlow: "none",
  motionFast: "160ms",
  motionBase: "320ms",
  ease: "cubic-bezier(0.3, 0.8, 0.3, 1)",
};

export const forestTheme: ThemeDefinition = {
  id: "forest",
  name: "Forest",
  description: "Warm, grounded and restorative.",
  defaultMode: "light",
  modes: {
    light: {
      style,
      colors: {
        bg: "#F5F0E1",
        surface1: "#FBF8EE",
        surface2: "#EFE8D3",
        surface3: "#E3DABF",
        text: "#1F2A1C",
        textMuted: "#4E5B47",
        accent: "#2F6B3A",
        accentContrast: "#FFFFFF",
        border: "#D6CCAB",
        borderStrong: "#7C7753",
        focus: "#A15C07",
        success: "#2F6B3A",
        warning: "#8A5A00",
        danger: "#A62B2B",
        chart1: "#2F6B3A",
        chart2: "#8A5A00",
        chart3: "#2E6F8E",
        chart4: "#8E3B6B",
      },
    },
    dark: {
      style: {
        ...style,
        shadowCard: "0 2px 0 rgb(0 0 0 / 0.35), 0 8px 24px rgb(0 0 0 / 0.40)",
        shadowRaised: "0 3px 0 rgb(0 0 0 / 0.4), 0 16px 40px rgb(0 0 0 / 0.5)",
        buttonShadow: "0 2px 0 rgb(0 0 0 / 0.5)",
        buttonShadowHover: "0 4px 0 rgb(0 0 0 / 0.5)",
        pageBackground:
          "radial-gradient(1000px 520px at 50% -12%, rgb(242 184 75 / 0.12), transparent 62%), linear-gradient(180deg, rgb(123 196 127 / 0.08), transparent 45%)",
      },
      colors: {
        bg: "#0E1A12",
        surface1: "#15251A",
        surface2: "#1C3122",
        surface3: "#254030",
        text: "#E8F0DC",
        textMuted: "#A9BBA0",
        accent: "#7BC47F",
        accentContrast: "#0E1A12",
        border: "#2F4A38",
        borderStrong: "#6E9477",
        focus: "#F2B84B",
        success: "#7BC47F",
        warning: "#F2B84B",
        danger: "#F28B82",
        chart1: "#7BC47F",
        chart2: "#F2B84B",
        chart3: "#6CB8D6",
        chart4: "#D98BB8",
      },
    },
  },
};
