import type { FocusRecord } from "./engine.ts";

/**
 * Study time from saved focus sessions. Only completed and interrupted sessions count; a
 * cancelled one (under a minute) is kept in the history but is never study time. Days follow the
 * student's own calendar (the device's time zone). Pure functions: "today" is always passed in.
 */

export function counted(records: readonly FocusRecord[]): FocusRecord[] {
  return records.filter((r) => r.status !== "cancelled");
}

export function dayKey(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y!, m! - 1, d! + days));
}

/** Monday of the week that holds this day. */
export function weekStart(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = (new Date(y!, m! - 1, d!).getDay() + 6) % 7; // Monday = 0
  return shiftDay(key, -dow);
}

export interface Totals {
  today: number;
  week: number;
  month: number;
  total: number;
  /** Counted sessions, all time. */
  sessions: number;
  completedToday: number;
  /** Average length of a counted session, in seconds. */
  average: number;
}

export function totals(records: readonly FocusRecord[], today: Date): Totals {
  const list = counted(records);
  const t = dayKey(today);
  const ws = weekStart(t);
  const month = t.slice(0, 7);
  let todaySec = 0;
  let week = 0;
  let monthSec = 0;
  let total = 0;
  let completedToday = 0;
  for (const r of list) {
    const k = dayKey(r.startedAt);
    total += r.focusSeconds;
    if (k === t) {
      todaySec += r.focusSeconds;
      if (r.status === "completed") completedToday++;
    }
    if (k >= ws && k <= t) week += r.focusSeconds;
    if (k.startsWith(month)) monthSec += r.focusSeconds;
  }
  return {
    today: todaySec,
    week,
    month: monthSec,
    total,
    sessions: list.length,
    completedToday,
    average: list.length === 0 ? 0 : Math.round(total / list.length),
  };
}

export interface Bucket {
  /** First day of the bucket, YYYY-MM-DD. */
  key: string;
  seconds: number;
}

/** The last `days` days, oldest first, with zero for quiet days. */
export function byDay(records: readonly FocusRecord[], today: Date, days: number): Bucket[] {
  const t = dayKey(today);
  const sums = new Map<string, number>();
  for (const r of counted(records)) {
    const k = dayKey(r.startedAt);
    sums.set(k, (sums.get(k) ?? 0) + r.focusSeconds);
  }
  const out: Bucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDay(t, -i);
    out.push({ key, seconds: sums.get(key) ?? 0 });
  }
  return out;
}

/** The last `weeks` weeks (Monday start), oldest first. */
export function byWeek(records: readonly FocusRecord[], today: Date, weeks: number): Bucket[] {
  const first = shiftDay(weekStart(dayKey(today)), -7 * (weeks - 1));
  const sums = new Map<string, number>();
  for (const r of counted(records)) {
    const k = weekStart(dayKey(r.startedAt));
    sums.set(k, (sums.get(k) ?? 0) + r.focusSeconds);
  }
  return Array.from({ length: weeks }, (_, i) => {
    const key = shiftDay(first, 7 * i);
    return { key, seconds: sums.get(key) ?? 0 };
  });
}

/** The last `months` calendar months, oldest first; `key` is the first of the month. */
export function byMonth(records: readonly FocusRecord[], today: Date, months: number): Bucket[] {
  const sums = new Map<string, number>();
  for (const r of counted(records)) {
    const k = dayKey(r.startedAt).slice(0, 7);
    sums.set(k, (sums.get(k) ?? 0) + r.focusSeconds);
  }
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
    const ym = dayKey(d).slice(0, 7);
    return { key: `${ym}-01`, seconds: sums.get(ym) ?? 0 };
  });
}

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/** Where the study time falls in the day. */
export function distribution(records: readonly FocusRecord[]): Record<DayPart, number> {
  const out: Record<DayPart, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const r of counted(records))
    out[dayPart(new Date(r.startedAt).getHours())] += r.focusSeconds;
  return out;
}

/** The hour (0 to 23) with the most study time, once there is enough to say; else null. */
export function bestHour(records: readonly FocusRecord[], minSessions = 5): number | null {
  const list = counted(records);
  if (list.length < minSessions) return null;
  const sums = new Array<number>(24).fill(0);
  for (const r of list) sums[new Date(r.startedAt).getHours()]! += r.focusSeconds;
  let best = 0;
  for (let h = 1; h < 24; h++) if (sums[h]! > sums[best]!) best = h;
  return best;
}

/** Days with study in the last `days` days, for the consistency line ("5 of the last 7 days"). */
export function activeDays(records: readonly FocusRecord[], today: Date, days: number): number {
  return byDay(records, today, days).filter((b) => b.seconds > 0).length;
}

export interface HeatCell {
  day: string;
  seconds: number;
  /** 0 (none) to 4 (most), relative to the student's own busiest day. */
  level: 0 | 1 | 2 | 3 | 4;
}

/** Weeks as columns (Monday first), the last `weeks` weeks ending with this one. */
export function heatmap(records: readonly FocusRecord[], today: Date, weeks = 12): HeatCell[][] {
  const t = dayKey(today);
  const first = shiftDay(weekStart(t), -7 * (weeks - 1));
  const sums = new Map<string, number>();
  for (const r of counted(records)) {
    const k = dayKey(r.startedAt);
    sums.set(k, (sums.get(k) ?? 0) + r.focusSeconds);
  }
  const max = Math.max(0, ...sums.values());
  const level = (s: number): HeatCell["level"] =>
    s <= 0 || max === 0
      ? 0
      : (Math.min(4, Math.max(1, Math.ceil((s / max) * 4))) as HeatCell["level"]);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = shiftDay(first, w * 7 + d);
      const seconds = day > t ? 0 : (sums.get(day) ?? 0);
      return { day, seconds, level: level(seconds) };
    }),
  );
}

/** Quiet total-hours milestones, in hours. */
export const MILESTONE_HOURS = [1, 10, 25, 50, 100, 250, 500, 1000] as const;

export function milestones(totalSeconds: number): {
  reached: number | null;
  next: number | null;
  toNext: number;
} {
  const hours = totalSeconds / 3600;
  const reached = [...MILESTONE_HOURS].reverse().find((h) => hours >= h) ?? null;
  const next = MILESTONE_HOURS.find((h) => hours < h) ?? null;
  return { reached, next, toNext: next === null ? 0 : Math.max(0, next * 3600 - totalSeconds) };
}

/** How steady a session was: its focus time as a share of what was planned. */
export function completion(r: FocusRecord): number | null {
  if (r.plannedSeconds === null || r.plannedSeconds <= 0) return null;
  return Math.min(1, r.focusSeconds / r.plannedSeconds);
}

/** Records on one day, newest first; or all of them when `day` is null. */
export function history(records: readonly FocusRecord[], day: string | null = null): FocusRecord[] {
  return records
    .filter((r) => day === null || dayKey(r.startedAt) === day)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
