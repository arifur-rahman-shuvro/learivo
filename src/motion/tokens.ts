/**
 * Every timing and easing curve the app uses, in one place. Change a number here and every
 * animation follows: CSS reads these as variables (see motionToCss), and the script-driven
 * animations (dialogs, menus) read the same values from MOTION directly.
 */
export const MOTION = {
  ease: {
    /** Fast start, soft landing. The default for things that open. */
    out: "cubic-bezier(0.22, 1, 0.36, 1)",
    /** Slow start, quick finish. For things that close. */
    in: "cubic-bezier(0.5, 0, 0.75, 0)",
    /** Overshoots a little and settles. For small playful pops. */
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    /** A gentler spring, for sliding highlights. */
    springSoft: "cubic-bezier(0.34, 1.3, 0.64, 1)",
    linear: "linear",
  },
  /** Durations in milliseconds. */
  ms: {
    open: 300,
    close: 200,
    menuIn: 260,
    menuOut: 160,
    pop: 320,
    toastIn: 340,
    toastOut: 180,
    item: 260,
    slide: 380,
    fade: 160,
    rise: 200,
    grow: 600,
  },
} as const;

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

/** The tokens above as CSS custom properties (--lv-m-ease-out, --lv-m-ms-open, ...). */
export function motionToCss(): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(MOTION.ease)) lines.push(`--lv-m-ease-${kebab(k)}:${v};`);
  for (const [k, v] of Object.entries(MOTION.ms)) lines.push(`--lv-m-ms-${kebab(k)}:${v}ms;`);
  return `:root{${lines.join("")}}`;
}
