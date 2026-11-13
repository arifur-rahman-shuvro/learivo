import { useEffect, useMemo, useState } from "react";
import { Badge, Button, EmptyState, PlusIcon, Spinner } from "../../../design-system/index.ts";
import { KIND_BY_DEPTH, type TaxonomyNode } from "../../question-bank/data/repo.ts";
import { errorText, useBank, useLoad } from "../../question-bank/ui/bank.tsx";
import type { Attempt, Exam } from "../data/repo.ts";
import type { PracticeFilter } from "../domain/session.ts";
import ExamBuilder from "./ExamBuilder.tsx";
import Player from "./Player.tsx";
import { clock, usePractice } from "./practice.tsx";
import Results from "./Results.tsx";
import { countAvailable, startExam, startPractice, type PracticeSetup } from "./start.ts";

type View = { name: "home" } | { name: "play"; id: string } | { name: "results"; id: string };

function nodeOptions(nodes: readonly TaxonomyNode[]) {
  const out: { id: string; label: string }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const n of nodes
      .filter((x) => x.parentId === parent)
      .sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ id: n.id, label: `${" ".repeat(depth)}${n.name}` });
      if (depth < KIND_BY_DEPTH.length - 1) walk(n.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

const DEFAULT_SETUP: PracticeSetup = {
  nodeId: null,
  tagId: null,
  collectionId: null,
  filter: "all",
  count: 20,
  minutes: null,
  instantFeedback: true,
  shuffleOptions: true,
};

const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function PracticeScreen() {
  const [view, setView] = useState<View>({ name: "home" });
  if (view.name === "play")
    return (
      <Player
        attemptId={view.id}
        onLeave={() => setView({ name: "home" })}
        onSubmitted={(id) => setView({ name: "results", id })}
      />
    );
  if (view.name === "results")
    return (
      <Results
        attemptId={view.id}
        onClose={() => setView({ name: "home" })}
        onStarted={(id) => setView({ name: "play", id })}
      />
    );
  return <Home onOpen={setView} />;
}

function Home({ onOpen }: { onOpen: (v: View) => void }) {
  const { repo } = useBank();
  const { attempts, rev, refresh } = usePractice();
  const taxonomy = useLoad((r) => r.taxonomy());
  const tags = useLoad((r) => r.tags());
  const collections = useLoad((r) => r.collections());
  const nodes = useMemo(() => taxonomy.data ?? [], [taxonomy.data]);
  const options = useMemo(() => nodeOptions(nodes), [nodes]);

  const [setup, setSetup] = useState<PracticeSetup>(DEFAULT_SETUP);
  const [available, setAvailable] = useState<number | null>(null);
  const [recent, setRecent] = useState<Attempt[] | null>(null);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [builder, setBuilder] = useState<null | "new" | Exam>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    Promise.all([attempts.list(15), attempts.exams()]).then(
      ([a, e]) => {
        if (!alive) return;
        setRecent(a);
        setExams(e);
      },
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [attempts, rev]);

  useEffect(() => {
    let alive = true;
    countAvailable(repo, attempts, setup).then(
      (n) => alive && setAvailable(n),
      () => alive && setAvailable(null),
    );
    return () => {
      alive = false;
    };
  }, [repo, attempts, rev, setup.nodeId, setup.tagId, setup.collectionId, setup.filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (p: Partial<PracticeSetup>) => setSetup((s) => ({ ...s, ...p }));

  async function begin(key: string, make: () => Promise<string>) {
    setBusy(key);
    setError(undefined);
    try {
      const id = await make();
      refresh();
      onOpen({ name: "play", id });
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  async function discard(id: string) {
    try {
      await attempts.remove(id);
      refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const inProgress = (recent ?? []).filter((a) => a.status === "in_progress");

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 id="module-title" className="m-0 text-3xl font-bold">
          Practice
        </h1>
        <p className="m-0 text-sm text-muted">Practise from your own bank, or sit a timed exam.</p>
      </header>

      {error && (
        <p
          role="alert"
          className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {inProgress.length > 0 && (
        <section aria-label="Unfinished sessions" className="lv-card flex flex-col gap-2 p-4">
          <h2 className="m-0 text-lg font-semibold">Continue where you left off</h2>
          {inProgress.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{a.title}</span>
                <span className="block text-xs text-muted">
                  {a.questionCount} question{a.questionCount === 1 ? "" : "s"} · started{" "}
                  {when(a.startedAt)}
                </span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => onOpen({ name: "play", id: a.id })}>
                  Resume
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void discard(a.id)}>
                  Discard
                </Button>
              </span>
            </div>
          ))}
        </section>
      )}

      <section aria-label="Start practice" className="lv-card flex flex-col gap-4 p-5">
        <h2 className="m-0 text-lg font-semibold">Start a practice session</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Subject
            <select
              className="lv-input"
              value={setup.nodeId ?? ""}
              onChange={(e) => patch({ nodeId: e.target.value || null })}
            >
              <option value="">All subjects</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Tag
            <select
              className="lv-input"
              value={setup.tagId ?? ""}
              onChange={(e) => patch({ tagId: e.target.value || null })}
            >
              <option value="">Any tag</option>
              {(tags.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Collection
            <select
              className="lv-input"
              value={setup.collectionId ?? ""}
              onChange={(e) => patch({ collectionId: e.target.value || null })}
            >
              <option value="">Any collection</option>
              {(collections.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Which questions
            <select
              className="lv-input"
              value={setup.filter}
              onChange={(e) => patch({ filter: e.target.value as PracticeFilter })}
            >
              <option value="all">All</option>
              <option value="unattempted">Not attempted yet</option>
              <option value="incorrect">Last answered wrong</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Number of questions
            <input
              className="lv-input"
              type="number"
              min={1}
              max={200}
              value={setup.count}
              onChange={(e) =>
                patch({
                  count: Math.min(200, Math.max(1, Math.floor(Number(e.target.value)) || 1)),
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Time limit (minutes)
            <input
              className="lv-input"
              type="number"
              min={1}
              max={600}
              placeholder="No limit"
              value={setup.minutes ?? ""}
              onChange={(e) =>
                patch({
                  minutes: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                })
              }
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={setup.instantFeedback}
              onChange={(e) => patch({ instantFeedback: e.target.checked })}
              className="size-4 accent-[var(--lv-accent)]"
            />
            Show the answer after each question
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={setup.shuffleOptions}
              onChange={(e) => patch({ shuffleOptions: e.target.checked })}
              className="size-4 accent-[var(--lv-accent)]"
            />
            Shuffle options
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            loading={busy === "practice"}
            disabled={available === 0}
            onClick={() => void begin("practice", () => startPractice(repo, attempts, setup))}
          >
            Start practice
          </Button>
          <span className="text-sm text-muted" aria-live="polite">
            {available === null
              ? ""
              : available === 0
                ? "No questions match these choices."
                : `${available} question${available === 1 ? "" : "s"} available`}
          </span>
        </div>
      </section>

      <section aria-label="Exams" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-lg font-semibold">Exams</h2>
          <Button
            variant="secondary"
            size="sm"
            icon={<PlusIcon />}
            onClick={() => setBuilder("new")}
          >
            New exam
          </Button>
        </div>
        {exams === null ? (
          <Spinner />
        ) : exams.length === 0 ? (
          <div className="lv-card">
            <EmptyState
              title="No exams yet"
              description="Build an exam from your subjects with a time limit and marking, then sit it whenever you like."
              action={<Button onClick={() => setBuilder("new")}>Create an exam</Button>}
            />
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {exams.map((x) => {
              const n = x.rules.reduce((t, r) => t + r.count, 0);
              return (
                <li
                  key={x.id}
                  className="lv-card flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="m-0 truncate font-semibold">{x.title}</p>
                    <p className="m-0 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>{n} questions</span>
                      <span>
                        {x.timeLimitSec
                          ? `${Math.round(x.timeLimitSec / 60)} min`
                          : "No time limit"}
                      </span>
                      {x.marksWrong > 0 && <Badge tone="warning">-{x.marksWrong} per wrong</Badge>}
                    </p>
                  </div>
                  <span className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setBuilder(x)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      loading={busy === x.id}
                      onClick={() => void begin(x.id, () => startExam(repo, attempts, x))}
                    >
                      Start exam
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Recent sessions" className="flex flex-col gap-3">
        <h2 className="m-0 text-lg font-semibold">Recent results</h2>
        {recent === null ? (
          <Spinner />
        ) : recent.filter((a) => a.status === "submitted").length === 0 ? (
          <p className="m-0 text-sm text-muted">Finished sessions appear here.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {recent
              .filter((a) => a.status === "submitted")
              .map((a) => (
                <li
                  key={a.id}
                  className="lv-card flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="m-0 truncate font-semibold">{a.title}</p>
                    <p className="m-0 text-xs text-muted">
                      {when(a.startedAt)} · {a.correct ?? 0}/{a.questionCount} correct ·{" "}
                      {clock(a.secondsSpent)}
                    </p>
                  </div>
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onOpen({ name: "results", id: a.id })}
                    >
                      View
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void discard(a.id)}>
                      Delete
                    </Button>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      {builder !== null && (
        <ExamBuilder exam={builder === "new" ? null : builder} onClose={() => setBuilder(null)} />
      )}
    </div>
  );
}
