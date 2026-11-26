import { compose, type Kind, type Tokens } from "../../../../supabase/functions/push/messages.ts";

export type Tone = "mix" | "motivating" | "funny" | "firm";

export interface PushSettings {
  enabled: boolean;
  tone: Tone;
  /** "HH:MM", the student's own time. */
  studyTime: string;
  quietStart: string;
  quietEnd: string;
  /** Kinds the student switched off. Missing means on. */
  kinds: Record<string, boolean>;
  maxPerDay: number;
}

export const DEFAULT_SETTINGS: PushSettings = {
  enabled: false,
  tone: "mix",
  studyTime: "18:00",
  quietStart: "22:00",
  quietEnd: "07:00",
  kinds: {},
  maxPerDay: 2,
};

export const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: "mix", label: "Mix", hint: "A bit of everything, changing day by day." },
  { value: "motivating", label: "Motivating", hint: "Warm and encouraging." },
  { value: "funny", label: "Funny", hint: "Light jokes to make you smile." },
  { value: "firm", label: "Firm", hint: "Short and direct, no jokes." },
];

export const KINDS: { id: Exclude<Kind, "test">; label: string; hint: string }[] = [
  {
    id: "daily",
    label: "Daily study reminder",
    hint: "At your study time, while today's goal is open.",
  },
  {
    id: "streak",
    label: "Streak guard",
    hint: "Evening nudge when a streak of 2+ days is at risk.",
  },
  { id: "revision", label: "Revision due", hint: "When 8 or more cards are waiting." },
  {
    id: "exam",
    label: "Exam countdown",
    hint: "30, 14, 7, 3 and 1 days before, plus the day itself.",
  },
  { id: "weak", label: "Weak-spot challenge", hint: "Every other day, for a subject under 60%." },
  { id: "comeback", label: "Welcome back", hint: "After 3, 7 and 14 days away, then it stops." },
  { id: "weekly", label: "Sunday summary", hint: "Your week in numbers." },
];

export const MAX_PER_DAY_CHOICES = [1, 2, 3];

type Row = {
  enabled: boolean;
  tone: string;
  study_time: string;
  quiet_start: string;
  quiet_end: string;
  kinds: Record<string, unknown> | null;
  max_per_day: number;
};

/** "18:00:00" from the database becomes "18:00" for the form. */
const hhmm = (t: string) => t.slice(0, 5);

export function fromRow(r: Row | null): PushSettings {
  if (!r) return { ...DEFAULT_SETTINGS };
  const kinds: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(r.kinds ?? {})) if (v === false) kinds[k] = false;
  return {
    enabled: r.enabled,
    tone: (TONES.some((t) => t.value === r.tone) ? r.tone : "mix") as Tone,
    studyTime: hhmm(r.study_time),
    quietStart: hhmm(r.quiet_start),
    quietEnd: hhmm(r.quiet_end),
    kinds,
    maxPerDay: r.max_per_day,
  };
}

export function toRow(s: PushSettings) {
  return {
    enabled: s.enabled,
    tone: s.tone,
    study_time: s.studyTime,
    quiet_start: s.quietStart,
    quiet_end: s.quietEnd,
    kinds: s.kinds,
    max_per_day: s.maxPerDay,
  };
}

/** The hour of day (0 to 23) the student most often starts a session, needing at least 3 in that hour. */
export function usualHour(startedAt: readonly string[]): number | null {
  const counts = new Map<number, number>();
  for (const iso of startedAt) {
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) continue;
    counts.set(t.getHours(), (counts.get(t.getHours()) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [h, n] of [...counts].sort((a, b) => a[0] - b[0])) {
    if (n >= 3 && (best === null || n > (counts.get(best) ?? 0))) best = h;
  }
  return best;
}

export const hourToTime = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function hourLabel(h: number): string {
  const suffix = h < 12 ? "am" : "pm";
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

/** What a notification in this voice would look like, with example numbers. */
export function previewFor(tone: Tone, day: number): { title: string; body: string } {
  const tokens: Tokens = {
    name: "there",
    left: "12 questions",
    goal: "20 questions",
    streak: "6-day",
    streakN: "6",
    due: "9 cards",
    days: "7 days",
    exam: "your exam",
    subject: "Renal physiology",
    pct: "54%",
    wkN: "84 questions",
    wkPct: "71%",
    trend: "up 6 points",
    away: "3 days",
  };
  const { title, body } = compose("daily", tone, tokens, "preview", day);
  return { title, body };
}

/** True when the quiet hours cover the study time, which would silence the daily reminder. */
export function studyTimeIsQuiet(
  s: Pick<PushSettings, "studyTime" | "quietStart" | "quietEnd">,
): boolean {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const [t, a, b] = [m(s.studyTime), m(s.quietStart), m(s.quietEnd)];
  if (a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}
