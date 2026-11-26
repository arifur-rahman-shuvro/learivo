/**
 * The Coach's brain: given one student's real numbers, decide whether to send something now, and
 * what. Pure functions, no network, so every rule is covered by unit tests.
 *
 * Principles: only true statements, one message per kind per day, never in quiet hours, a hard daily
 * cap, a gap between messages, and less often when messages are being ignored.
 */
import { compose, type Kind, type Tokens, type Tone, type Words } from "./messages.ts";

/** One row of push_facts(), in camelCase. */
export interface Facts {
  userId: string;
  localNow: string; // "2026-11-25T18:00:00" in the student's own time
  tone: Tone;
  studyTime: string; // "18:00:00"
  quietStart: string;
  quietEnd: string;
  kinds: Record<string, unknown>;
  maxPerDay: number;
  snoozeUntil: string | null; // ISO instant
  displayName: string;
  dailyGoal: number;
  answeredToday: number;
  streak: number;
  daysAway: number | null;
  dueCards: number;
  examDate: string | null; // "2026-12-02"
  examTitle: string;
  weakSubject: string | null;
  weakPercent: number | null;
  weekAnswered: number;
  weekPercent: number | null;
  prevWeekPercent: number | null;
  sentToday: number;
  sentKindsToday: string[];
  lastSentAt: string | null; // ISO instant
  ignoredInARow: number;
  totalAnswers: number;
}

/** Where tapping the notification (or its first button) takes the student. */
export type Go = "quick" | "revision" | "insights" | `weak:${string}`;

export interface Decision {
  kind: Kind;
  go: Go;
  title: string;
  body: string;
  voice: string;
  /** Replaces an older undelivered message of the same kind on the phone. */
  tag: string;
  buttons: { action: "start" | "later"; title: string }[];
}

export const MIN_GAP_HOURS = 3;
export const STUDY_WINDOW_MINUTES = 180;
export const EXAM_MILESTONES = [30, 14, 7, 3, 1, 0];
export const COMEBACK_DAYS = [3, 7, 14];

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
};

/** Minutes since midnight and the calendar date, from a local timestamp string. */
export function parseLocal(local: string): {
  date: string;
  minute: number;
  weekday: number;
  dayNumber: number;
} {
  const [date, time] = local.split("T");
  const minute = minutes((time ?? "00:00").slice(0, 5));
  const [y, mo, d] = (date ?? "1970-01-01").split("-").map(Number) as [number, number, number];
  const ms = Date.UTC(y, mo - 1, d);
  return {
    date: date!,
    minute,
    weekday: new Date(ms).getUTCDay(),
    dayNumber: Math.floor(ms / 86400000),
  };
}

function inQuietHours(minute: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

export function daysUntil(examDate: string, localDate: string): number {
  return Math.round((Date.parse(examDate) - Date.parse(localDate)) / 86400000);
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function tokensFor(f: Facts, local: ReturnType<typeof parseLocal>): Tokens {
  const left = Math.max(1, f.dailyGoal - f.answeredToday);
  const days = f.examDate ? daysUntil(f.examDate, local.date) : 0;
  const diff =
    f.weekPercent === null || f.prevWeekPercent === null ? 0 : f.weekPercent - f.prevWeekPercent;
  return {
    name: f.displayName.trim().split(/\s+/)[0] || "there",
    left: plural(left, "question"),
    goal: plural(f.dailyGoal, "question"),
    streak: `${f.streak}-day`,
    streakN: String(f.streak),
    due: plural(f.dueCards, "card"),
    days: days === 0 ? "today" : days === 1 ? "tomorrow" : `${days} days`,
    exam: f.examTitle.trim() || "your exam",
    subject: f.weakSubject ?? "your weakest subject",
    pct: f.weakPercent === null ? "low" : `${f.weakPercent}%`,
    wkN: plural(f.weekAnswered, "question"),
    wkPct: f.weekPercent === null ? "-" : `${f.weekPercent}%`,
    trend:
      f.weekPercent === null || f.prevWeekPercent === null || Math.abs(diff) < 1
        ? "steady"
        : `${diff > 0 ? "up" : "down"} ${Math.abs(diff)} point${Math.abs(diff) === 1 ? "" : "s"}`,
    away: plural(f.daysAway ?? 0, "day"),
  };
}

/** The cap for today, lowered when the student has been ignoring messages. */
export function effectiveCap(f: Facts): number {
  if (f.ignoredInARow >= 10) return 0;
  if (f.ignoredInARow >= 5) return Math.max(1, Math.floor(f.maxPerDay / 2));
  return f.maxPerDay;
}

const on = (f: Facts, kind: Kind) => f.kinds[kind] !== false;

/** True while a message of the "study" family (daily, revision, weak, comeback) can go out. */
function inStudyWindow(f: Facts, minute: number): boolean {
  const start = minutes(f.studyTime);
  return minute >= start && minute < start + STUDY_WINDOW_MINUTES;
}

/**
 * Decides what to send to one student right now, or null. `now` is the real instant (to check the
 * snooze and the gap since the last message).
 */
export function decide(f: Facts, now: Date): Decision | null {
  if (f.totalAnswers === 0 && f.streak === 0 && !f.examDate) return null; // nothing to talk about yet
  if (f.snoozeUntil && Date.parse(f.snoozeUntil) > now.getTime()) return null;

  const local = parseLocal(f.localNow);
  if (inQuietHours(local.minute, minutes(f.quietStart), minutes(f.quietEnd))) return null;
  if (f.sentToday >= effectiveCap(f)) return null;
  if (f.lastSentAt && now.getTime() - Date.parse(f.lastSentAt) < MIN_GAP_HOURS * 3600_000)
    return null;

  const sent = new Set(f.sentKindsToday);
  const studyFamily = ["daily", "revision", "weak", "comeback"];
  const studyDone = studyFamily.some((k) => sent.has(k));
  const goalDone = f.answeredToday >= f.dailyGoal;
  const quietStart = minutes(f.quietStart);
  const toks = tokensFor(f, local);

  const make = (kind: Kind, go: Go, buttons: Decision["buttons"]): Decision => {
    const words: Words & { voice: string } = compose(
      kind,
      f.tone,
      toks,
      `${f.userId}:${kind}`,
      local.dayNumber,
    );
    return { kind, go, ...words, tag: kind, buttons };
  };
  const start = { action: "start", title: "Start 5" } as const;
  const later = { action: "later", title: "Later" } as const;

  // 1. Exam countdown on its milestone days, in the study window.
  if (on(f, "exam") && f.examDate && !sent.has("exam") && inStudyWindow(f, local.minute)) {
    const d = daysUntil(f.examDate, local.date);
    if (EXAM_MILESTONES.includes(d) && !goalDone && f.weakSubject) {
      return make("exam", `weak:${f.weakSubject}`, [
        { action: "start", title: "Practise it" },
        later,
      ]);
    }
    if (EXAM_MILESTONES.includes(d) && !goalDone) return make("exam", "quick", [start, later]);
  }

  // 2. Streak guard in the evening: after 19:00 and two hours after the study time, never late.
  const streakStart = Math.max(19 * 60, minutes(f.studyTime) + 120);
  if (
    on(f, "streak") &&
    !sent.has("streak") &&
    f.streak >= 2 &&
    f.answeredToday === 0 &&
    local.minute >= streakStart &&
    local.minute < quietStart - 30
  ) {
    return make("streak", "quick", [{ action: "start", title: "Save my streak" }, later]);
  }

  // 3. One study message a day, at the study time, while the goal is not done.
  if (!studyDone && !goalDone && inStudyWindow(f, local.minute)) {
    if (on(f, "comeback") && f.daysAway !== null && COMEBACK_DAYS.includes(f.daysAway)) {
      return make("comeback", "quick", [start, later]);
    }
    if (f.daysAway === null || f.daysAway < 3) {
      if (on(f, "revision") && f.dueCards >= 8) {
        return make("revision", "revision", [{ action: "start", title: "Revise now" }, later]);
      }
      // Alternate between the weak-spot challenge and the plain nudge, so the days differ.
      if (
        on(f, "weak") &&
        f.weakSubject &&
        f.weakPercent !== null &&
        f.weakPercent < 60 &&
        local.dayNumber % 2 === 0
      ) {
        return make("weak", `weak:${f.weakSubject}`, [{ action: "start", title: "Try 8" }, later]);
      }
      if (on(f, "daily")) return make("daily", "quick", [start, later]);
    }
  }

  // 4. Sunday summary, once, in the evening.
  if (
    on(f, "weekly") &&
    !sent.has("weekly") &&
    local.weekday === 0 &&
    f.weekAnswered > 0 &&
    local.minute >= Math.max(18 * 60, minutes(f.studyTime)) &&
    local.minute < quietStart - 30
  ) {
    return make("weekly", "insights", [{ action: "start", title: "See Insights" }, later]);
  }
  return null;
}
