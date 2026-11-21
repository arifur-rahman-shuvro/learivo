import { useGrown } from "../../../motion/index.ts";
import type { ActivityDay, ConfidenceRow, ReasonRow } from "../domain/insights.ts";
import { confidenceLabel, type CalibrationCounts } from "../../practice/domain/confidence.ts";
import { REASONS, reasonLabel } from "../../practice/domain/reasons.ts";
import PractiseArea from "./PractiseArea.tsx";
import { MIN_ANSWERS, type Allocation, type Readiness } from "../domain/readiness.ts";

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
  const grown = useGrown();
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
                  height: d.count === 0 ? 3 : `${grown ? (d.count / max) * 100 : 0}%`,
                  background: d.count === 0 ? "var(--lv-surface-3)" : "var(--lv-accent)",
                  opacity: i === days.length - 1 ? 1 : 0.7,
                  transition: "height 600ms var(--lv-ease)",
                  transitionDelay: `${i * 45}ms`,
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

/** Accuracy at each confidence level, plus a plain-words note on over-confidence and luck. */
export function ConfidenceBars({
  rows,
  counts,
}: {
  rows: ConfidenceRow[];
  counts: CalibrationCounts;
}) {
  if (counts.rated === 0) {
    return (
      <p className="m-0 text-sm text-muted">
        While you answer, tap Sure, Not sure or Guess under the answer. Here you will see how often
        each one is right, and which answers were wrong beliefs or lucky guesses.
      </p>
    );
  }
  const sure = rows.find((r) => r.confidence === "sure");
  const overconfident =
    sure && sure.answered >= 5 && sure.accuracy < 0.8
      ? `When you are sure you are right only ${Math.round(sure.accuracy * 100)}% of the time. Double-check answers you feel certain about.`
      : null;
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {rows.map((r) => (
          <li key={r.confidence} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{confidenceLabel(r.confidence)}</span>
              <span className="font-mono text-muted">
                {r.answered === 0
                  ? "no answers"
                  : `${Math.round(r.accuracy * 100)}% right · ${r.answered}`}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${confidenceLabel(r.confidence)}: ${Math.round(r.accuracy * 100)}% right of ${r.answered} answers`}
              className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-3"
            >
              <div
                className="h-full rounded-pill bg-accent"
                style={{ width: `${Math.round(r.accuracy * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        {counts.overconfident > 0 && (
          <li>
            <strong>{counts.overconfident}</strong> answers were sure but wrong: wrong beliefs, the
            most important to fix.
          </li>
        )}
        {counts.shaky > 0 && (
          <li>
            <strong>{counts.shaky}</strong> right answers were unsure or guessed: they may be luck.
          </li>
        )}
        {overconfident && <li>{overconfident}</li>}
      </ul>
    </div>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Readiness estimate with its range, and a split of the next practice across areas, with reasons. */
export function ReadinessCard({
  readiness,
  plan,
  note,
  onNavigate,
}: {
  readiness: Readiness;
  plan: Allocation[];
  note?: string | null;
  onNavigate: (route: string) => void;
}) {
  return (
    <section aria-label="Readiness" className="lv-card flex flex-col gap-3 p-5">
      <h2 className="m-0 text-lg font-semibold">Readiness</h2>
      {readiness.estimate === null ? (
        <p className="m-0 text-sm text-muted">
          Not enough answers yet for an estimate. You have {readiness.answers} so far; it appears
          after {MIN_ANSWERS}.
        </p>
      ) : (
        <>
          <p className="m-0 text-3xl font-bold tabular-nums">
            {pct(readiness.estimate)}
            <span className="ml-2 text-sm font-normal text-muted">
              likely range {pct(readiness.low ?? 0)} to {pct(readiness.high ?? 1)}
            </span>
          </p>
          <p className="m-0 text-sm text-muted">
            How likely you are to get a question from your own bank right today, worked out from{" "}
            {readiness.answers} answers, with recent ones counting more.
            {readiness.level === "early" &&
              " It is an early estimate and will settle as you answer more."}{" "}
            It is not a prediction of your exam mark.
          </p>
        </>
      )}
      {plan.length > 0 && (
        <>
          <h3 className="m-0 mt-2 text-base font-semibold">
            Where to spend your next {plan.reduce((s, p) => s + p.questions, 0)} questions
          </h3>
          {note && <p className="m-0 text-sm text-muted">{note}</p>}
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {plan.map((p) => (
              <li key={p.name} className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">
                    {p.name}{" "}
                    <span className="font-normal text-muted">· {p.questions} questions</span>
                  </span>
                  <span className="text-sm text-muted">{p.why.join(" ")}</span>
                </div>
                <PractiseArea area={p.name} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
