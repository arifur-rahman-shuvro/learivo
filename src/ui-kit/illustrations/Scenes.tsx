/**
 * Small flat scenes for empty and error states (LV-002, LV-003, LV-004 in the visual blueprint).
 * Drawn only with theme variables, so they recolour in every theme and mode. Decorative: the
 * heading and text beside them carry the meaning.
 */
const base = {
  width: 120,
  height: 96,
  viewBox: "0 0 120 96",
  fill: "none",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  className: "lv-rise-in",
} as const;

const line = "var(--lv-border-strong)";
const card = "var(--lv-surface-2)";
const deep = "var(--lv-surface-3)";
const accent = "var(--lv-accent)";

/** A short stack of question cards with a plus badge: nothing here yet, cards go here. */
export function QuestionsScene() {
  return (
    <svg {...base}>
      <rect
        x="22"
        y="22"
        width="68"
        height="50"
        rx="9"
        fill={deep}
        stroke={line}
        transform="rotate(-6 56 47)"
      />
      <rect
        x="26"
        y="26"
        width="68"
        height="50"
        rx="9"
        fill={deep}
        stroke={line}
        transform="rotate(4 60 51)"
      />
      <rect x="24" y="24" width="68" height="50" rx="9" fill={card} stroke={line} />
      <path d="M36 40h34M36 51h22" stroke={line} />
      <circle cx="36" cy="63" r="3" fill={deep} stroke={line} />
      <circle cx="90" cy="26" r="12" fill={accent} stroke="none" />
      <path d="M90 20v12M84 26h12" stroke="var(--lv-bg)" strokeWidth={2.25} />
    </svg>
  );
}

/** A clipboard with a big check and a few small dots: everything is done. */
export function CaughtUpScene() {
  return (
    <svg {...base}>
      <rect x="32" y="16" width="56" height="68" rx="9" fill={card} stroke={line} />
      <rect x="48" y="11" width="24" height="10" rx="5" fill={deep} stroke={line} />
      <circle cx="60" cy="46" r="15" fill={accent} stroke="none" />
      <path d="m53 46 5 5 10-11" stroke="var(--lv-bg)" strokeWidth={2.5} />
      <path d="M44 71h32" stroke={line} />
      <circle cx="20" cy="28" r="2.5" fill="var(--lv-chart-2)" stroke="none" />
      <circle cx="102" cy="22" r="2.5" fill={accent} stroke="none" />
      <circle cx="106" cy="58" r="2" fill="var(--lv-chart-2)" stroke="none" />
      <circle cx="14" cy="64" r="2" fill={accent} stroke="none" />
    </svg>
  );
}

/** A document with a folded corner and a refresh arrow: something went wrong, try again. */
export function ErrorScene() {
  return (
    <svg {...base}>
      <path
        d="M34 14h34l18 18v46a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z"
        fill={card}
        stroke={line}
      />
      <path d="M68 14v14a4 4 0 0 0 4 4h14" fill={deep} stroke={line} />
      <path d="M40 46h26M40 57h16" stroke={line} />
      <circle cx="82" cy="68" r="14" fill="var(--lv-bg)" stroke={accent} />
      <path d="M89 66a8 8 0 1 0 1 6" stroke={accent} />
      <path d="M90 59v7h-7" stroke={accent} />
      <circle cx="24" cy="30" r="3" fill="var(--lv-danger)" stroke="none" />
    </svg>
  );
}
