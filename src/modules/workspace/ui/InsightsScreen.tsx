import { shortTime } from "../../practice/domain/pace.ts";
import PractiseArea from "./PractiseArea.tsx";
import { useIntent } from "../../../core/intents.ts";
import { useEffect, useMemo, useState } from "react";
import { achievements } from "../domain/achievements.ts";
import {
  Badge,
  Button,
  EmptyState,
  InsightsIcon,
  ProgressBar,
  ProgressRing,
  PanelSkeleton,
  InsightsScene,
} from "../../../ui-kit/index.ts";
import { clock } from "../../practice/ui/practice.tsx";
import { useInsightsData } from "./useInsightsData.ts";
import { ConfidenceBars, FlameIcon, Heatmap, ReadinessCard, ReasonBars } from "./InsightsParts.tsx";
import { allocate, planSize, readiness } from "../domain/readiness.ts";
import { DEFAULT_GOAL } from "../data/repo.ts";
import { daysUntil, NO_EXAM } from "../domain/examTarget.ts";
import { useWorkspace } from "./workspace.tsx";
import {
  accuracyByDay,
  activeDaySet,
  activityByDay,
  bestAndWorst,
  byArea,
  byConfidence,
  byReason,
  examHistory,
  overall,
  speedByArea,
  streak,
  studyTimeByDay,
} from "../domain/insights.ts";
import { LineChart } from "./InsightsCharts.tsx";

type Tab = "overview" | "subjects" | "exams" | "time" | "achievements";
const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["subjects", "Subjects"],
  ["exams", "Exams"],
  ["time", "Study time"],
  ["achievements", "Achievements"],
];

const dayLabel = (day: string) => {
  const [, m, d] = day.split("-");
  return `${Number(d)}/${Number(m)}`;
};

export default function InsightsScreen({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { data, error } = useInsightsData();
  const [tab, setTab] = useState<Tab>("overview");
  useIntent((i) => {
    if (i.kind === "open" && TABS.some(([k]) => k === i.target)) setTab(i.target as Tab);
  });
  const [depth, setDepth] = useState<1 | 2>(1);
  const today = useMemo(() => new Date(), []);
  const ws = useWorkspace().repo;
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [examDays, setExamDays] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all([ws.dailyGoal(), ws.examTarget().catch(() => NO_EXAM)]).then(
      ([g, ex]) => {
        if (!alive) return;
        setGoal(g);
        setExamDays(ex.date ? daysUntil(ex.date, new Date()) : null);
      },
      () => undefined, // the plan falls back to the default goal
    );
    return () => {
      alive = false;
    };
  }, [ws]);
  const size = planSize(goal, examDays);

  const view = useMemo(() => {
    if (!data) return null;
    const { facts, sessions } = data;
    const days = activeDaySet(sessions, facts);
    return {
      all: overall(facts),
      streak: streak(days, today),
      trend: accuracyByDay(facts, today, 30),
      areas: byArea(facts, depth),
      readiness: readiness(facts, today, depth),
      exams: examHistory(sessions),
      time: studyTimeByDay(sessions, today, 14),
      totalSeconds: sessions.reduce((n, s) => n + s.secondsSpent, 0),
      sessions: sessions.length,
      badges: achievements(facts, sessions),
      reasons: byReason(facts),
      confidence: byConfidence(facts),
      activity: activityByDay(facts, today, 84),
      extremes: bestAndWorst(facts),
      speed: speedByArea(facts, depth),
      avgSeconds: (() => {
        const t = facts.filter((f) => (f.seconds ?? 0) > 0);
        return t.length >= 5 ? t.reduce((n, f) => n + (f.seconds ?? 0), 0) / t.length : null;
      })(),
    };
  }, [data, today, depth]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 id="module-title" className="m-0 text-3xl font-bold">
          Progress
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
      {!data && !error && <PanelSkeleton />}

      {data && view && data.facts.length === 0 && data.sessions.length === 0 && (
        <div className="lv-card">
          <EmptyState
            title="Nothing to show yet"
            icon={<InsightsIcon size={36} />}
            art={<InsightsScene />}
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
              <section
                aria-label="Summary"
                className="lv-card flex flex-wrap items-center gap-x-8 gap-y-4 p-5 sm:p-6"
              >
                <ProgressRing
                  size={112}
                  value={(view.all.accuracy ?? 0) * 100}
                  label="Overall accuracy"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="m-0 text-4xl font-bold tabular-nums">
                    {view.all.accuracy === null ? "-" : `${Math.round(view.all.accuracy * 100)}%`}
                  </p>
                  <p className="m-0 text-sm text-muted">
                    {view.all.correct.toLocaleString()} right of{" "}
                    {view.all.answered.toLocaleString()} answered, over {view.sessions}{" "}
                    {view.sessions === 1 ? "session" : "sessions"}.
                  </p>
                  <p className="m-0 mt-1 inline-flex items-center gap-1.5 text-sm font-semibold">
                    <span className={view.streak > 0 ? "text-[#f59e0b]" : "text-muted"}>
                      <FlameIcon />
                    </span>
                    {view.streak > 0
                      ? `${view.streak}-day streak`
                      : "No streak yet. Answer a question today."}
                  </p>
                </div>
              </section>

              <ReadinessCard
                readiness={view.readiness}
                plan={allocate(view.readiness, size.questions)}
                note={size.note}
                onNavigate={onNavigate}
              />

              {view.extremes.best && view.extremes.worst && (
                <section
                  aria-label="Strongest and weakest"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  {[
                    { k: "Strongest subject", a: view.extremes.best, tone: "success" as const },
                    { k: "Needs the most work", a: view.extremes.worst, tone: "danger" as const },
                  ].map(({ k, a, tone }) => (
                    <div key={k} className="lv-card flex flex-col gap-1 p-4">
                      <Badge tone={tone}>{k}</Badge>
                      <p className="m-0 truncate text-lg font-bold">{a.name}</p>
                      <p className="m-0 text-sm text-muted">
                        {Math.round(a.accuracy * 100)}% · {a.correct} of {a.total}
                      </p>
                      {tone === "danger" && (
                        <div className="mt-1">
                          <PractiseArea area={a.name} onNavigate={onNavigate} />
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}

              <section aria-label="Why you lose marks" className="lv-card flex flex-col gap-3 p-5">
                <h2 className="m-0 text-lg font-semibold">Why you lose marks</h2>
                <ReasonBars
                  rows={view.reasons.rows}
                  untagged={view.reasons.untagged}
                  missed={view.reasons.missed}
                />
              </section>

              <section aria-label="Confidence" className="lv-card flex flex-col gap-3 p-5">
                <h2 className="m-0 text-lg font-semibold">How sure you are</h2>
                <ConfidenceBars rows={view.confidence.rows} counts={view.confidence.counts} />
              </section>

              <section aria-label="Activity" className="lv-card flex flex-col gap-3 p-5">
                <h2 className="m-0 text-lg font-semibold">Your last 12 weeks</h2>
                <Heatmap days={view.activity} today={today} />
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
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="font-mono text-muted">
                            {a.correct}/{a.total} · {Math.round(a.accuracy * 100)}%
                          </span>
                          <PractiseArea area={a.name} onNavigate={onNavigate} />
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
              {view.avgSeconds !== null && (
                <p className="m-0 text-sm">
                  You take about <strong>{shortTime(view.avgSeconds)}</strong> per question.
                </p>
              )}
              <div
                className="flex h-32 items-end gap-1.5"
                role="img"
                aria-label="Minutes studied per day for the last 14 days"
              >
                {(() => {
                  const max = Math.max(60, ...view.time.map((t) => t.seconds));
                  return view.time.map((t, i) => (
                    <div
                      key={t.day}
                      className="flex flex-1 flex-col items-center justify-end gap-1"
                    >
                      <div
                        className="lv-grow-y w-full rounded-t bg-accent"
                        style={{
                          animationDelay: `${i * 35}ms`,
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
          {tab === "time" && view.speed.length > 0 && (
            <section aria-label="Time per question" className="lv-card flex flex-col gap-3 p-5">
              <h2 className="m-0 text-lg font-semibold">Time per question, by subject</h2>
              <p className="m-0 text-sm text-muted">
                Slowest first. Subjects with fewer than 5 timed answers are left out.
              </p>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {view.speed.slice(0, 8).map((r) => (
                  <li key={r.name} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-semibold">{r.name}</span>
                      <span className="font-mono">{shortTime(r.average)}</span>
                    </div>
                    <ProgressBar
                      value={r.average / view.speed[0]!.average}
                      label={`${r.name}: ${shortTime(r.average)} per question`}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {tab === "achievements" && (
            <section aria-label="Achievements" className="flex flex-col gap-3">
              <p className="m-0 text-sm text-muted" aria-live="polite">
                {view.badges.filter((b) => b.earned).length} of {view.badges.length} earned. These
                come only from your own sessions and are never shared.
              </p>
              <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
                {view.badges.map((b) => (
                  <li
                    key={b.id}
                    className={`lv-card flex flex-col gap-2 p-4 ${b.earned ? "border-accent" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="m-0 text-base font-semibold">{b.title}</h2>
                      <Badge tone={b.earned ? "success" : "neutral"}>
                        {b.earned ? "Earned" : "Locked"}
                      </Badge>
                    </div>
                    <p className="m-0 text-sm text-muted">{b.description}</p>
                    {!b.earned && (
                      <ProgressBar
                        value={(b.current / b.target) * 100}
                        label={`${b.title}: ${b.current} of ${b.target}`}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
