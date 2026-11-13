import { useMemo, useState } from "react";
import { Button, EmptyState, Spinner } from "../../../design-system/index.ts";
import { clock } from "../../practice/ui/practice.tsx";
import { useInsightsData } from "./useInsightsData.ts";
import {
  accuracyByDay,
  activeDaySet,
  byArea,
  examHistory,
  overall,
  streak,
  studyTimeByDay,
} from "../domain/insights.ts";

type Tab = "overview" | "subjects" | "exams" | "time";
const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["subjects", "Subjects"],
  ["exams", "Exams"],
  ["time", "Study time"],
];

const dayLabel = (day: string) => {
  const [, m, d] = day.split("-");
  return `${Number(d)}/${Number(m)}`;
};

function LineChart({
  points,
  label,
}: {
  points: { label: string; value: number }[];
  label: string;
}) {
  const W = 320;
  const H = 130;
  const pad = { l: 30, r: 8, t: 8, b: 20 };
  const x = (i: number) =>
    points.length === 1
      ? (pad.l + W - pad.r) / 2
      : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--lv-border)"
              strokeWidth="1"
            />
            <text
              x={pad.l - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize="9"
              fill="var(--lv-text-muted)"
            >
              {v}%
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <path
            d={path}
            fill="none"
            stroke="var(--lv-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r="3.5" fill="var(--lv-accent)" />
        ))}
        {[0, points.length - 1].map((i, k) =>
          points[i] && (k === 0 || points.length > 1) ? (
            <text
              key={k}
              x={x(i)}
              y={H - 4}
              textAnchor={k === 0 ? "start" : "end"}
              fontSize="9"
              fill="var(--lv-text-muted)"
            >
              {points[i]!.label}
            </text>
          ) : null,
        )}
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-semibold">View as table</summary>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border-b border-line py-1 pr-3 font-semibold">Date</th>
              <th className="border-b border-line py-1 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td className="py-1 pr-3">{p.label}</td>
                <td className="py-1">{p.value}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="lv-card p-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

export default function InsightsScreen({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { data, error } = useInsightsData();
  const [tab, setTab] = useState<Tab>("overview");
  const [depth, setDepth] = useState<1 | 2>(1);
  const today = useMemo(() => new Date(), []);

  const view = useMemo(() => {
    if (!data) return null;
    const { facts, sessions } = data;
    const days = activeDaySet(sessions, facts);
    return {
      all: overall(facts),
      streak: streak(days, today),
      trend: accuracyByDay(facts, today, 30),
      areas: byArea(facts, depth),
      exams: examHistory(sessions),
      time: studyTimeByDay(sessions, today, 14),
      totalSeconds: sessions.reduce((n, s) => n + s.secondsSpent, 0),
      sessions: sessions.length,
    };
  }, [data, today, depth]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 id="module-title" className="m-0 text-3xl font-bold">
          Insights
        </h1>
        <p className="m-0 text-sm text-muted">
          What your finished sessions say about your studying.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {!data && !error && (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      )}

      {data && view && data.facts.length === 0 && data.sessions.length === 0 && (
        <div className="lv-card">
          <EmptyState
            title="Nothing to show yet"
            description="Finish a practice session or an exam and your results appear here."
            action={<Button onClick={() => onNavigate("#/practice")}>Start practising</Button>}
          />
        </div>
      )}

      {data && view && (data.facts.length > 0 || data.sessions.length > 0) && (
        <>
          <div
            role="tablist"
            aria-label="Insights sections"
            className="flex gap-1 overflow-x-auto border-b border-line"
          >
            {TABS.map(([k, label]) => (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${
                  tab === k ? "border-accent text-fg" : "border-transparent text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <>
              <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Tile label="Questions answered" value={view.all.answered.toLocaleString()} />
                <Tile
                  label="Accuracy"
                  value={
                    view.all.accuracy === null ? "-" : `${Math.round(view.all.accuracy * 100)}%`
                  }
                />
                <Tile label="Day streak" value={String(view.streak)} />
                <Tile label="Sessions" value={String(view.sessions)} />
              </section>
              <section aria-label="Accuracy trend" className="lv-card flex flex-col gap-3 p-5">
                <h2 className="m-0 text-lg font-semibold">Accuracy, last 30 days</h2>
                {view.trend.length === 0 ? (
                  <p className="m-0 text-sm text-muted">No answers in the last 30 days.</p>
                ) : (
                  <LineChart
                    label="Accuracy by day over the last 30 days"
                    points={view.trend.map((p) => ({
                      label: dayLabel(p.day),
                      value: Math.round(p.accuracy * 100),
                    }))}
                  />
                )}
              </section>
            </>
          )}

          {tab === "subjects" && (
            <section aria-label="Subjects" className="lv-card flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-lg font-semibold">Accuracy by area, weakest first</h2>
                <Button variant="secondary" size="sm" onClick={() => setDepth(depth === 1 ? 2 : 1)}>
                  {depth === 1 ? "Show chapters" : "Show subjects only"}
                </Button>
              </div>
              {view.areas.length === 0 ? (
                <p className="m-0 text-sm text-muted">No answers yet.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {view.areas.map((a) => (
                    <li key={a.name} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-semibold">{a.name}</span>
                        <span className="font-mono text-muted">
                          {a.correct}/{a.total} · {Math.round(a.accuracy * 100)}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`${a.name} accuracy`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(a.accuracy * 100)}
                        className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-3"
                      >
                        <div
                          className="h-full rounded-pill bg-accent"
                          style={{ width: `${a.accuracy * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === "exams" && (
            <section aria-label="Exams" className="lv-card flex flex-col gap-3 p-5">
              <h2 className="m-0 text-lg font-semibold">Exam scores over time</h2>
              {view.exams.length === 0 ? (
                <p className="m-0 text-sm text-muted">Sit an exam and its score appears here.</p>
              ) : (
                <LineChart
                  label="Exam scores as a percentage of full marks"
                  points={view.exams.map((e) => ({
                    label: `${dayLabel(e.at.slice(0, 10))} ${e.title}`,
                    value: Math.max(0, Math.min(100, e.percent)),
                  }))}
                />
              )}
            </section>
          )}

          {tab === "time" && (
            <section aria-label="Study time" className="lv-card flex flex-col gap-3 p-5">
              <h2 className="m-0 text-lg font-semibold">Study time, last 14 days</h2>
              <p className="m-0 text-sm text-muted">
                Total: {clock(view.totalSeconds)} across {view.sessions} sessions.
              </p>
              <div
                className="flex h-32 items-end gap-1.5"
                role="img"
                aria-label="Minutes studied per day for the last 14 days"
              >
                {(() => {
                  const max = Math.max(60, ...view.time.map((t) => t.seconds));
                  return view.time.map((t) => (
                    <div
                      key={t.day}
                      className="flex flex-1 flex-col items-center justify-end gap-1"
                    >
                      <div
                        className="w-full rounded-t bg-accent"
                        style={{
                          height: `${(t.seconds / max) * 100}%`,
                          minHeight: t.seconds > 0 ? 3 : 0,
                        }}
                      />
                      <span className="text-[10px] text-muted">
                        {dayLabel(t.day).split("/")[0]}
                      </span>
                    </div>
                  ));
                })()}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold">View as table</summary>
                <table className="mt-2 w-full border-collapse text-left">
                  <tbody>
                    {view.time.map((t) => (
                      <tr key={t.day}>
                        <td className="py-1 pr-3">{dayLabel(t.day)}</td>
                        <td className="py-1">{Math.round(t.seconds / 60)} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </section>
          )}
        </>
      )}
    </div>
  );
}
