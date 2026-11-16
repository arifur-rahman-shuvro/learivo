import type { ActivityDay, ReasonRow } from "../domain/insights.ts";
import { REASONS, reasonLabel } from "../../practice/domain/reasons.ts";

export function FlameIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3c.5 3-1.5 4.5-3 6.5C7.6 11.3 7 12.7 7 14a5 5 0 0 0 10 0c0-1.8-.8-3-1.8-4.2-.4 1-1 1.6-1.7 1.8.6-3-.3-6-1.5-8.6Z" />
    </svg>
  );
}

const SHADES = [0.12, 0.35, 0.6, 0.85, 1];

/** Calendar grid of answers per day: columns are weeks, rows are weekdays (Sunday on top). */
export function Heatmap({ days, today }: { days: ActivityDay[]; today: Date }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  // Pad the front so the first column starts on a Sunday.
  const first = new Date(`${days[0]!.day}T00:00:00`);
  const pad = first.getDay();
  const cells: (ActivityDay | null)[] = [...Array<null>(pad).fill(null), ...days];
  const weeks: (ActivityDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const total = days.reduce((n, d) => n + d.count, 0);
  const active = days.filter((d) => d.count > 0).length;
  const label = `Answers per day over the last ${days.length} days. ${total} answers on ${active} days.`;
  void today;
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${weeks.length * 14} 98`}
          role="img"
          aria-label={label}
          className="h-auto min-w-[16rem] w-full max-w-[34rem]"
        >
          {weeks.map((w, wi) =>
            w.map((d, di) =>
              d ? (
                <rect
                  key={d.day}
                  x={wi * 14}
                  y={di * 14}
                  width="11"
                  height="11"
                  rx="3"
                  fill={d.count === 0 ? "var(--lv-surface-3)" : "var(--lv-accent)"}
                  opacity={d.count === 0 ? 1 : SHADES[level(d.count)]}
                >
                  <title>{`${d.day}: ${d.count} answered`}</title>
                </rect>
              ) : null,
            ),
          )}
        </svg>
      </div>
      <figcaption className="flex items-center gap-1.5 text-xs text-muted">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span
            key={l}
            aria-hidden="true"
            className="inline-block size-3 rounded-[3px]"
            style={{
              background: l === 0 ? "var(--lv-surface-3)" : "var(--lv-accent)",
              opacity: l === 0 ? 1 : SHADES[l],
            }}
          />
        ))}
        More
      </figcaption>
    </figure>
  );
}

const TONES: Record<string, string> = {
  careless: "#f59e0b",
  not_known: "#ef4444",
  mixed_up: "#8b5cf6",
  guessed: "#0ea5e9",
};

/** One stacked bar for why missed questions were missed, with a legend that carries the numbers. */
export function ReasonBars({
  rows,
  untagged,
  missed,
}: {
  rows: ReasonRow[];
  untagged: number;
  missed: number;
}) {
  const shown = rows.reduce((n, r) => n + r.count, 0);
  if (missed === 0) return <p className="m-0 text-sm text-muted">No missed questions yet. Nice.</p>;
  if (shown === 0) {
    return (
      <p className="m-0 text-sm text-muted">
        You have {missed} missed {missed === 1 ? "question" : "questions"}. After a session, open a
        wrong answer in Results and tap why you missed it. This chart then shows where your marks
        go.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`Reasons for missed questions: ${rows.map((r) => `${reasonLabel(r.reason)} ${r.count}`).join(", ")}`}
        className="flex h-4 w-full overflow-hidden rounded-pill bg-surface-3"
      >
        {rows.map((r) => (
          <div
            key={r.reason}
            style={{ width: `${(r.count / shown) * 100}%`, background: TONES[r.reason] }}
          />
        ))}
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
        {REASONS.map((r) => {
          const n = rows.find((x) => x.reason === r.id)?.count ?? 0;
          return (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              <span
                aria-hidden="true"
                className="mt-1 inline-block size-3 shrink-0 rounded-[3px]"
                style={{ background: TONES[r.id] }}
              />
              <span>
                <span className="font-semibold">{r.label}</span>{" "}
                <span className="font-mono text-muted">
                  {n} · {Math.round((n / shown) * 100)}%
                </span>
                <span className="block text-xs text-muted">{r.hint}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {untagged > 0 && (
        <p className="m-0 text-xs text-muted">
          {untagged} more missed {untagged === 1 ? "question has" : "questions have"} no reason yet.
        </p>
      )}
    </div>
  );
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Seven bars, one per day, ending today. A dashed line marks the daily goal. */
export function WeekBars({ days, goal }: { days: ActivityDay[]; goal: number }) {
  const max = Math.max(goal, ...days.map((d) => d.count), 1);
  const total = days.reduce((n, d) => n + d.count, 0);
  const label = `Answers in the last ${days.length} days: ${days
    .map((d) => `${WEEKDAY[new Date(`${d.day}T00:00:00`).getDay()]} ${d.count}`)
    .join(", ")}. Daily goal ${goal}.`;
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="relative" style={{ height: 112 }} role="img" aria-label={label}>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-dashed border-line-strong"
          style={{ bottom: `${(goal / max) * 100}%` }}
        />
        <div className="absolute inset-0 flex items-end gap-2">
          {days.map((d, i) => (
            <div key={d.day} className="flex h-full flex-1 flex-col justify-end">
              <div
                aria-hidden="true"
                className="w-full rounded-t-[6px]"
                style={{
                  height: d.count === 0 ? 3 : `${(d.count / max) * 100}%`,
                  background: d.count === 0 ? "var(--lv-surface-3)" : "var(--lv-accent)",
                  opacity: i === days.length - 1 ? 1 : 0.7,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="flex gap-2 text-center text-xs text-muted">
        {days.map((d, i) => (
          <span
            key={d.day}
            className={`flex-1 ${i === days.length - 1 ? "font-bold text-fg" : ""}`}
          >
            {i === days.length - 1 ? "Today" : WEEKDAY[new Date(`${d.day}T00:00:00`).getDay()]}
          </span>
        ))}
      </div>
      <figcaption className="text-xs text-muted">
        {total === 0
          ? "No answers yet this week. The dashed line is your daily goal."
          : `${total} answered in 7 days. The dashed line is your daily goal.`}
      </figcaption>
    </figure>
  );
}
