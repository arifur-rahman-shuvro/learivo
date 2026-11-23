import { useIntent } from "../../../core/intents.ts";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Picker,
  SparkIcon,
  PlusIcon,
  PracticeIcon,
  ListSkeleton,
  ExamsScene,
} from "../../../ui-kit/index.ts";
import { errorText, useBank, useLoad } from "../../question-bank/ui/bank.tsx";
import type { Attempt, Exam } from "../data/repo.ts";
import { MISTAKE_GROUPS } from "../domain/groups.ts";
import { REASONS } from "../domain/reasons.ts";
import type { PracticeFilter } from "../domain/session.ts";
import ExamBuilder from "./ExamBuilder.tsx";
import { clock, usePractice } from "./practice.tsx";
import { useWorkspace } from "../../workspace/ui/workspace.tsx";
import { subjectOptions } from "../../question-bank/ui/subjectOptions.ts";
import { ExamPaperDialog } from "./ExamPaperDialog.tsx";
import {
  countAvailable,
  startExam,
  startPractice,
  smartPreview,
  startSmart,
  type PracticeSetup,
} from "./start.ts";
import { DEFAULT_SETUP, PRESETS, SETUP_KEY, rememberedSetup } from "./practiceSetup.ts";

export type View =
  { name: "home" } | { name: "play"; id: string } | { name: "results"; id: string };

const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function PracticeHome({ onOpen }: { onOpen: (v: View) => void }) {
  const { repo } = useBank();
  const { attempts, rev, refresh } = usePractice();
  const workspace = useWorkspace().repo;
  const taxonomy = useLoad((r) => r.taxonomy());
  const tags = useLoad((r) => r.tags());
  const collections = useLoad((r) => r.collections());
  const nodes = useMemo(() => taxonomy.data ?? [], [taxonomy.data]);
  const options = useMemo(() => subjectOptions(nodes), [nodes]);

  const [setup, setSetup] = useState<PracticeSetup>(rememberedSetup);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [smart, setSmart] = useState<{
    due: number;
    weak: number;
    fresh: number;
    focus: boolean;
  } | null>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [recent, setRecent] = useState<Attempt[] | null>(null);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [builder, setBuilder] = useState<null | "new" | Exam>(null);
  const [paperOf, setPaperOf] = useState<Exam | null>(null);
  useIntent((i) => {
    if (i.kind === "open" && i.target === "exam") setBuilder("new");
  });
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
    countAvailable(repo, attempts, setup, workspace).then(
      (n) => alive && setAvailable(n),
      () => alive && setAvailable(null),
    );
    return () => {
      alive = false;
    };
  }, [repo, attempts, workspace, rev, setup.nodeId, setup.tagId, setup.collectionId, setup.filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    Promise.all(
      PRESETS.map((p) =>
        countAvailable(repo, attempts, { ...DEFAULT_SETUP, ...p.patch }, workspace).then(
          (n) => [p.id, n] as const,
        ),
      ),
    ).then(
      (rows) => alive && setCounts(Object.fromEntries(rows)),
      () => alive && setCounts(null),
    );
    return () => {
      alive = false;
    };
  }, [repo, attempts, workspace, rev]);

  useEffect(() => {
    let alive = true;
    smartPreview(repo, attempts, workspace).then(
      (p) => alive && setSmart(p),
      () => alive && setSmart(null),
    );
    return () => {
      alive = false;
    };
  }, [repo, attempts, workspace, rev]);

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

      <section aria-label="Quick start" className="flex flex-col gap-2">
        <h2 className="m-0 text-lg font-semibold">Quick start</h2>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void begin("smart", () => startSmart(repo, attempts, workspace))}
          className="lv-card flex items-center gap-3 border-accent p-4 text-left disabled:opacity-50"
        >
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent"
          >
            <SparkIcon size={22} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{busy === "smart" ? "Starting…" : "Smart mix"}</span>
            <span className="text-xs text-muted">
              {smart
                ? `20 questions for today: ${smart.due} revision due, ${smart.weak} weak, ${smart.fresh} new${smart.focus ? ", mostly from your exam subjects" : ""}`
                : "20 questions: revision that is due, your weak areas and new questions"}
            </span>
          </span>
        </button>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {PRESETS.map((p) => {
            const n = counts?.[p.id];
            const empty = n === 0;
            return (
              <button
                key={p.id}
                type="button"
                disabled={empty || busy !== null}
                onClick={() =>
                  void begin(p.id, () =>
                    startPractice(repo, attempts, { ...DEFAULT_SETUP, ...p.patch }, workspace),
                  )
                }
                className="lv-card flex min-h-20 flex-col items-start justify-center gap-0.5 p-3 text-left disabled:opacity-50"
              >
                <span className="font-semibold">{busy === p.id ? "Starting…" : p.label}</span>
                <span className="text-xs text-muted">
                  {n === undefined || p.id === "quick"
                    ? p.hint
                    : empty
                      ? "None yet"
                      : `${n} ${p.hint.toLowerCase()}`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <details className="lv-card group p-5" open={false}>
        <summary className="cursor-pointer list-none text-lg font-semibold">
          <span className="flex items-center justify-between gap-2">
            Custom practice
            <span
              aria-hidden="true"
              className="text-muted transition-transform group-open:rotate-90"
            >
              ›
            </span>
          </span>
          <span className="block text-sm font-normal text-muted">
            Pick a subject, tag, count and time
          </span>
        </summary>
        <section aria-label="Start practice" className="mt-4 flex flex-col gap-4">
          <h2 className="sr-only">Start a practice session</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Picker
              label="Subject"
              emptyLabel="All subjects"
              value={setup.nodeId ?? ""}
              options={options}
              onChange={(v) => patch({ nodeId: v || null })}
            />
            <Picker
              label="Tag"
              emptyLabel="Any tag"
              value={setup.tagId ?? ""}
              options={(tags.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
              onChange={(v) => patch({ tagId: v || null })}
            />
            <Picker
              label="Collection"
              emptyLabel="Any collection"
              value={setup.collectionId ?? ""}
              options={(collections.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              onChange={(v) => patch({ collectionId: v || null })}
            />
            <Picker
              label="Which questions"
              value={setup.filter}
              options={[
                { value: "all", label: "All" },
                { value: "unattempted", label: "Not attempted yet" },
                { value: "bookmarked", label: "Bookmarked" },
                { value: "incorrect", label: "Last answered wrong" },
                ...MISTAKE_GROUPS.filter((g) => g.id !== "wrong").map((g) => ({
                  value: g.id,
                  label: REASONS.some((r) => r.id === g.id) ? `Missed: ${g.label}` : g.label,
                })),
              ]}
              onChange={(v) => patch({ filter: v as PracticeFilter })}
            />
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
              onClick={() =>
                void begin("practice", () => {
                  try {
                    window.localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
                  } catch {
                    // Remembering the last choices is a convenience only.
                  }
                  return startPractice(repo, attempts, setup, workspace);
                })
              }
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
      </details>

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
          <ListSkeleton rows={2} />
        ) : exams.length === 0 ? (
          <div className="lv-card">
            <EmptyState
              title="No exams yet"
              icon={<PracticeIcon size={36} />}
              art={<ExamsScene />}
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
                    <Button size="sm" variant="secondary" onClick={() => setPaperOf(x)}>
                      Print paper
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
          <ListSkeleton rows={3} />
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

      {paperOf && <ExamPaperDialog exam={paperOf} bank={repo} onClose={() => setPaperOf(null)} />}

      {builder !== null && (
        <ExamBuilder exam={builder === "new" ? null : builder} onClose={() => setBuilder(null)} />
      )}
    </div>
  );
}
