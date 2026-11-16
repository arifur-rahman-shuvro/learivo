import FeaturesDialog from "../../../app/FeaturesDialog.tsx";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, ProgressBar, ProgressRing, Spinner } from "../../../design-system/index.ts";
import Home from "../../../app/screens/Home.tsx";
import { SAMPLE_QUESTIONS } from "../../question-bank/domain/sample.ts";
import { DEFAULT_QUERY } from "../../question-bank/data/repo.ts";
import { usePractice } from "../../practice/ui/practice.tsx";
import { errorText, useBank } from "../../question-bank/ui/bank.tsx";
import { DEFAULT_GOAL } from "../data/repo.ts";
import {
  NO_EXAM,
  cleanExamTarget,
  daysUntil,
  studyPlan,
  type ExamTarget,
} from "../domain/examTarget.ts";
import {
  activeDaySet,
  activityByDay,
  answeredOn,
  overall,
  streak,
  weakAreas,
} from "../domain/insights.ts";
import { WeekBars } from "./InsightsParts.tsx";
import { isDue } from "../domain/scheduler.ts";
import {
  DEFAULT_HOME_LAYOUT,
  visibleSections,
  type HomeLayout,
  type HomeSectionId,
} from "../domain/homeLayout.ts";
import CustomizeDialog from "./CustomizeDialog.tsx";
import { useInsightsData } from "./useInsightsData.ts";
import { useWorkspace } from "./workspace.tsx";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="lv-card p-4">
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

/** Home for a student who has questions: today's focus, goal, streak and weak areas. */
export default function HomeDashboard({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { repo: bank, rev: bankRev, refresh: refreshBank } = useBank();
  const { attempts, rev: practiceRev } = usePractice();
  const [seen, setSeen] = useState(0);
  const ws = useWorkspace();
  const { data } = useInsightsData();
  const [total, setTotal] = useState<number | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [layout, setLayout] = useState<HomeLayout>(DEFAULT_HOME_LAYOUT);
  const [customizing, setCustomizing] = useState(false);
  const [features, setFeatures] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(DEFAULT_GOAL));
  const [error, setError] = useState<string>();
  const [exam, setExam] = useState<ExamTarget>(NO_EXAM);
  const [examEditing, setExamEditing] = useState(false);
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      bank.list({ ...DEFAULT_QUERY, limit: 1 }),
      ws.repo.cards(),
      ws.repo.dailyGoal(),
      ws.repo.homeLayout().catch(() => DEFAULT_HOME_LAYOUT),
      ws.repo.examTarget().catch(() => NO_EXAM),
      attempts.past().then(
        (m) => m.size,
        () => 0,
      ),
    ]).then(
      ([page, cards, g, lay, ex, practised]) => {
        if (!alive) return;
        const now = new Date();
        setTotal(page.total);
        setSeen(practised);
        setDueCount(cards.filter((c) => isDue(c, now)).length);
        setGoal(g);
        setDraft(String(g));
        setLayout(lay);
        setExam(ex);
        setExamTitle(ex.title);
        setExamDate(ex.date ?? "");
      },
      // Home must still open when the extras cannot load.
      () => alive && setTotal(-1),
    );
    return () => {
      alive = false;
    };
  }, [bank, bankRev, attempts, practiceRev, ws.repo, ws.rev]);

  const today = useMemo(() => new Date(), []);
  const view = useMemo(() => {
    if (!data) return null;
    return {
      all: overall(data.facts),
      streak: streak(activeDaySet(data.sessions, data.facts), today),
      today: answeredOn(data.facts, today),
      weak: weakAreas(data.facts).slice(0, 3),
      recent: data.sessions.slice(0, 4),
      week: activityByDay(data.facts, today, 7),
    };
  }, [data, today]);

  async function saveLayout(next: HomeLayout) {
    await ws.repo.setHomeLayout(next);
    setLayout(next);
  }

  async function saveExam(clear = false) {
    setError(undefined);
    try {
      const next = clear ? NO_EXAM : cleanExamTarget({ title: examTitle, date: examDate });
      if (!clear && next.date === null) throw new Error("Choose the exam date.");
      await ws.repo.setExamTarget(next);
      setExam(next);
      setExamTitle(next.title);
      setExamDate(next.date ?? "");
      setExamEditing(false);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function saveGoal() {
    const n = Number(draft);
    setError(undefined);
    try {
      await ws.repo.setDailyGoal(n);
      setGoal(n);
      setEditing(false);
      ws.refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  // Nothing to show yet, or the data could not load: the starter page.
  if (total === null) return <div role="status" aria-label="Loading" className="min-h-40" />;
  if (total <= 0)
    return (
      <Home
        onNavigate={onNavigate}
        onSamples={async () => {
          await bank.create(SAMPLE_QUESTIONS);
          refreshBank();
        }}
      />
    );

  const done = view?.today ?? 0;
  const blocks: Record<HomeSectionId, ReactNode> = {
    focus: (
      <section
        aria-label="Today's focus"
        className="lv-card flex flex-wrap items-center justify-between gap-4 p-5"
      >
        <div className="min-w-0">
          <h2 className="m-0 text-lg font-bold">
            {dueCount > 0
              ? `${dueCount} card${dueCount === 1 ? "" : "s"} due for revision`
              : "Nothing due for revision"}
          </h2>
          <p className="m-0 text-sm text-muted">
            {dueCount > 0
              ? "Revise them while they are fresh."
              : "Start a practice session to keep your streak going."}
          </p>
        </div>
        {dueCount > 0 ? (
          <Button onClick={() => onNavigate("#/review")}>Start revision</Button>
        ) : (
          <Button onClick={() => onNavigate("#/practice")}>Start practice</Button>
        )}
      </section>
    ),
    numbers: (
      <section aria-label="Your numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Questions" value={total.toLocaleString()} />
        <Tile label="Due for revision" value={String(dueCount)} />
        <Tile label="Day streak" value={String(view?.streak ?? 0)} />
        <Tile
          label="Accuracy"
          value={view?.all.accuracy == null ? "-" : `${Math.round(view.all.accuracy * 100)}%`}
        />
      </section>
    ),
    goal: (
      <section aria-labelledby="goal-title" className="lv-card flex items-center gap-5 p-5 sm:p-6">
        <ProgressRing
          value={Math.min(100, (done / goal) * 100)}
          size={88}
          label="Daily goal progress"
        />
        <div className="min-w-0">
          <h2 id="goal-title" className="m-0 text-lg font-bold">
            Daily goal
          </h2>
          <p className="m-0 mt-1 text-sm text-muted">
            {done} of {goal} questions today.
          </p>
          {editing ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className="lv-input w-24"
                type="number"
                min={1}
                max={500}
                aria-label="Questions per day"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button size="sm" onClick={() => void saveGoal()}>
                Save goal
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button className="mt-2" size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Change goal
            </Button>
          )}
          {error && (
            <p role="alert" className="m-0 mt-1 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </section>
    ),
    week: (
      <section aria-labelledby="week-title" className="lv-card flex flex-col gap-3 p-5">
        <h2 id="week-title" className="m-0 text-lg font-semibold">
          This week
        </h2>
        {view ? <WeekBars days={view.week} goal={goal} /> : <Spinner />}
      </section>
    ),
    weak: (
      <section aria-labelledby="weak-title" className="lv-card p-5 sm:p-6">
        <h2 id="weak-title" className="m-0 mb-2 text-lg font-bold">
          Weak areas
        </h2>
        {view && view.weak.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {view.weak.map((a) => (
              <li key={a.name} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-semibold">{a.name}</span>
                <span className="font-mono text-muted">{Math.round(a.accuracy * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted">
            Areas where you score under 70% after 5 or more answers show up here.
          </p>
        )}
      </section>
    ),
    recent:
      view && view.recent.length > 0 ? (
        <section aria-labelledby="recent-title" className="lv-card p-5 sm:p-6">
          <h2 id="recent-title" className="m-0 mb-2 text-lg font-bold">
            Recent sessions
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {view.recent.map((s, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-semibold">{s.title}</span>
                <span className="shrink-0 text-muted">
                  {s.correct}/{s.questionCount} correct ·{" "}
                  {Math.max(1, Math.round(s.secondsSpent / 60))} min
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null,
    exam: (
      <section aria-labelledby="exam-title" className="lv-card flex flex-col gap-2 p-5 sm:p-6">
        <h2 id="exam-title" className="m-0 text-lg font-bold">
          Exam countdown
        </h2>
        {examEditing ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="exam-name" className="text-sm font-semibold">
                Exam name
              </label>
              <input
                id="exam-name"
                className="lv-input"
                maxLength={120}
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="exam-date" className="text-sm font-semibold">
                Exam date
              </label>
              <input
                id="exam-date"
                type="date"
                className="lv-input"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => void saveExam()}>
              Save exam
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExamEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : exam.date ? (
          <>
            <ExamLine exam={exam} total={total} seen={seen} today={today} />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setExamEditing(true)}>
                Change exam
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void saveExam(true)}>
                Remove exam
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="m-0 text-sm text-muted">Set your next exam to count the days down.</p>
            <div>
              <Button size="sm" variant="secondary" onClick={() => setExamEditing(true)}>
                Set exam date
              </Button>
            </div>
          </>
        )}
      </section>
    ),
  };
  const wide: Record<HomeSectionId, boolean> = {
    focus: true,
    numbers: true,
    goal: false,
    week: false,
    weak: false,
    recent: true,
    exam: false,
  };
  const shown = visibleSections(layout);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="module-title" className="m-0 text-3xl font-bold">
          Today
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setFeatures(true)}>
            All features
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCustomizing(true)}>
            Customize
          </Button>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        {shown.map((id) =>
          blocks[id] ? (
            <div key={id} className={wide[id] ? "lg:col-span-2" : ""}>
              {blocks[id]}
            </div>
          ) : null,
        )}
      </div>
      {shown.length === 0 && (
        <p className="m-0 text-sm text-muted">
          Every section is hidden. Use Customize to show some again.
        </p>
      )}
      <FeaturesDialog open={features} onClose={() => setFeatures(false)} onNavigate={onNavigate} />
      {customizing && (
        <CustomizeDialog
          layout={layout}
          onSave={saveLayout}
          onClose={() => setCustomizing(false)}
        />
      )}
    </div>
  );
}

function ExamLine({
  exam,
  total,
  seen,
  today,
}: {
  exam: ExamTarget;
  total: number;
  seen: number;
  today: Date;
}) {
  const days = daysUntil(exam.date!, today);
  const name = exam.title || "Your exam";
  if (days < 0)
    return (
      <p className="m-0">
        {name} was {-days} day{days === -1 ? "" : "s"} ago.
      </p>
    );
  if (days === 0) return <p className="m-0 text-xl font-bold">{name} is today.</p>;
  const plan = studyPlan(total, seen, days);
  return (
    <>
      <p className="m-0 text-3xl font-bold">
        {days} day{days === 1 ? "" : "s"}
      </p>
      <p className="m-0 text-sm text-muted">until {name}.</p>
      <p className="m-0 mt-1 text-sm">
        {plan.perDay
          ? `${plan.unseen.toLocaleString()} of your ${total.toLocaleString()} questions are not practised yet. About ${plan.perDay} a day finishes them in time.`
          : `You have practised every question. Use the days left to revise your mistakes.`}
      </p>
      <ProgressBar value={plan.coverage} label="Questions practised at least once" />
    </>
  );
}
