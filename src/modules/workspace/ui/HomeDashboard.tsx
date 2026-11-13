import { useEffect, useMemo, useState } from "react";
import { Button, ProgressRing } from "../../../design-system/index.ts";
import Home from "../../../app/screens/Home.tsx";
import { DEFAULT_QUERY } from "../../question-bank/data/repo.ts";
import { errorText, useBank } from "../../question-bank/ui/bank.tsx";
import { DEFAULT_GOAL } from "../data/repo.ts";
import { activeDaySet, answeredOn, overall, streak, weakAreas } from "../domain/insights.ts";
import { isDue } from "../domain/scheduler.ts";
import { useInsightsData } from "./InsightsScreen.tsx";
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
  const { repo: bank, rev: bankRev } = useBank();
  const ws = useWorkspace();
  const { data } = useInsightsData();
  const [total, setTotal] = useState<number | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(DEFAULT_GOAL));
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    Promise.all([
      bank.list({ ...DEFAULT_QUERY, limit: 1 }),
      ws.repo.cards(),
      ws.repo.dailyGoal(),
    ]).then(
      ([page, cards, g]) => {
        if (!alive) return;
        const now = new Date();
        setTotal(page.total);
        setDueCount(cards.filter((c) => isDue(c, now)).length);
        setGoal(g);
        setDraft(String(g));
      },
      // Home must still open when the extras cannot load.
      () => alive && setTotal(-1),
    );
    return () => {
      alive = false;
    };
  }, [bank, bankRev, ws.repo, ws.rev]);

  const today = useMemo(() => new Date(), []);
  const view = useMemo(() => {
    if (!data) return null;
    return {
      all: overall(data.facts),
      streak: streak(activeDaySet(data.sessions, data.facts), today),
      today: answeredOn(data.facts, today),
      weak: weakAreas(data.facts).slice(0, 3),
      recent: data.sessions.slice(0, 4),
    };
  }, [data, today]);

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
  if (total <= 0) return <Home onNavigate={onNavigate} />;

  const done = view?.today ?? 0;
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 id="module-title" className="m-0 text-3xl font-bold">
          Today
        </h1>
      </header>

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

      <section aria-label="Your numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Questions" value={total.toLocaleString()} />
        <Tile label="Due for revision" value={String(dueCount)} />
        <Tile label="Day streak" value={String(view?.streak ?? 0)} />
        <Tile
          label="Accuracy"
          value={view?.all.accuracy == null ? "-" : `${Math.round(view.all.accuracy * 100)}%`}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section
          aria-labelledby="goal-title"
          className="lv-card flex items-center gap-5 p-5 sm:p-6"
        >
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
      </div>

      {view && view.recent.length > 0 && (
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
      )}
    </div>
  );
}
