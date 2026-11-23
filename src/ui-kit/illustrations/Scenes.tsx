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

/** A chart card with three bars, the middle one in the accent: what Insights will show. */
export function InsightsScene() {
  return (
    <svg {...base}>
      <rect x="22" y="14" width="76" height="62" rx="10" fill={card} stroke={line} />
      <rect x="36" y="48" width="11" height="18" rx="3" fill={deep} stroke={line} />
      <rect x="54.5" y="32" width="11" height="34" rx="3" fill={accent} stroke="none" />
      <rect x="73" y="40" width="11" height="26" rx="3" fill={deep} stroke={line} />
      <path d="M32 70h56" stroke={line} strokeDasharray="2 4" />
      <path d="M34 26h22" stroke={line} />
      <circle cx="98" cy="20" r="3" fill="var(--lv-chart-2)" stroke="none" />
    </svg>
  );
}

/** A magnifier over an empty dashed card: the filter found nothing. */
export function SearchScene() {
  return (
    <svg {...base}>
      <rect
        x="20"
        y="16"
        width="64"
        height="52"
        rx="9"
        fill={card}
        stroke={line}
        strokeDasharray="4 4"
      />
      <path d="M32 34h28M32 45h18" stroke={line} />
      <circle cx="78" cy="56" r="17" fill="var(--lv-bg)" stroke={accent} strokeWidth={2.25} />
      <path d="m90.5 68.5 12 12" stroke={accent} strokeWidth={3} />
      <circle cx="102" cy="22" r="2.5" fill="var(--lv-chart-2)" stroke="none" />
    </svg>
  );
}

/** A bookmark ribbon (the brand ribbon) beside a small note card: saved things live here. */
export function SavedScene() {
  return (
    <svg {...base}>
      <rect x="46" y="26" width="54" height="46" rx="9" fill={card} stroke={line} />
      <path d="M58 42h30M58 53h20" stroke={line} />
      <path d="M22 14h24v48l-12-10-12 10z" fill={accent} stroke="none" />
      <circle cx="104" cy="20" r="2.5" fill="var(--lv-chart-2)" stroke="none" />
    </svg>
  );
}

/** An exam paper with a clock badge: timed exams will appear here. */
export function ExamsScene() {
  return (
    <svg {...base}>
      <rect x="26" y="12" width="56" height="72" rx="9" fill={card} stroke={line} />
      <path d="M38 30h32M38 42h32M38 54h20" stroke={line} />
      <circle cx="84" cy="64" r="16" fill="var(--lv-bg)" stroke={accent} strokeWidth={2.25} />
      <path d="M84 55v10l7 4" stroke={accent} />
    </svg>
  );
}

/** Two overlapping cards, the front one with a question mark: flashcards and glossary terms. */
export function CardsScene() {
  return (
    <svg {...base}>
      <rect
        x="34"
        y="14"
        width="58"
        height="52"
        rx="9"
        fill={deep}
        stroke={line}
        transform="rotate(8 63 40)"
      />
      <rect x="22" y="22" width="62" height="54" rx="9" fill={card} stroke={line} />
      <path d="M47 42a8 8 0 1 1 11 7c-3 1.5-4 3-4 6" stroke={accent} strokeWidth={2.25} />
      <circle cx="54" cy="64" r="1.75" fill={accent} stroke="none" />
      <circle cx="100" cy="20" r="2.5" fill="var(--lv-chart-2)" stroke="none" />
    </svg>
  );
}
