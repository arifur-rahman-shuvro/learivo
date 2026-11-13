import { useEffect, useMemo, useState } from "react";
import { Badge, Button, ProgressRing, Spinner } from "../../../design-system/index.ts";
import { errorText } from "../../question-bank/ui/bank.tsx";
import { TYPE_LABELS } from "../../question-bank/domain/model.ts";
import type { AttemptWithItems } from "../data/repo.ts";
import { clock, usePractice } from "./practice.tsx";
import ResponseInput from "./ResponseInput.tsx";
import { startRetry } from "./start.ts";

type Show = "all" | "wrong" | "unanswered" | "flagged";

interface Props {
  attemptId: string;
  onClose: () => void;
  onStarted: (attemptId: string) => void;
}

export default function Results({ attemptId, onClose, onStarted }: Props) {
  const { attempts, refresh } = usePractice();
  const [a, setA] = useState<AttemptWithItems | null>(null);
  const [error, setError] = useState<string>();
  const [show, setShow] = useState<Show>("all");
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    attempts.get(attemptId).then(
      (r) => alive && setA(r),
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [attempts, attemptId]);

  const bySubject = useMemo(() => {
    const map = new Map<string, { right: number; total: number }>();
    for (const i of a?.items ?? []) {
      const name = i.snapshot.path[0] ?? "Unclassified";
      const row = map.get(name) ?? { right: 0, total: 0 };
      row.total += 1;
      if (i.verdict === "correct") row.right += 1;
      map.set(name, row);
    }
    return [...map.entries()].sort((x, y) => y[1].total - x[1].total);
  }, [a]);

  if (error) return <p role="alert">{error}</p>;
  if (!a)
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );

  const items = a.items.filter(
    (i) =>
      show === "all" ||
      (show === "wrong" && i.verdict === "wrong") ||
      (show === "unanswered" && i.verdict === "unanswered") ||
      (show === "flagged" && i.flagged),
  );
  const answered = (a.correct ?? 0) + (a.wrong ?? 0);
  const percent = a.questionCount === 0 ? 0 : ((a.correct ?? 0) / a.questionCount) * 100;
  const missed = a.items.some((i) => i.verdict !== "correct" && i.questionId !== null);

  async function retry() {
    setBusy(true);
    setError(undefined);
    try {
      const id = await startRetry(attempts, a!);
      refresh();
      onStarted(id);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="module-title" className="m-0 text-3xl font-bold">
            Results
          </h1>
          <p className="m-0 text-sm text-muted">{a.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {missed && (
            <Button loading={busy} onClick={() => void retry()}>
              Practice missed questions
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </header>

      <section aria-label="Summary" className="lv-card flex flex-wrap items-center gap-6 p-5">
        <ProgressRing value={percent} label="Correct answers" size={112} />
        <dl className="m-0 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
          {[
            ["Score", `${a.score ?? 0} / ${a.questionCount * a.marksCorrect}`],
            ["Correct", String(a.correct ?? 0)],
            ["Wrong", String(a.wrong ?? 0)],
            ["Skipped", String(a.unanswered ?? 0)],
            [
              "Accuracy",
              answered === 0 ? "-" : `${Math.round(((a.correct ?? 0) / answered) * 100)}%`,
            ],
            ["Time", clock(a.secondsSpent)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold text-muted">{k}</dt>
              <dd className="m-0 text-xl font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {bySubject.length > 0 && (
        <section aria-label="By subject" className="lv-card p-5">
          <h2 className="m-0 mb-3 text-lg font-semibold">By subject</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {bySubject.map(([name, r]) => (
              <li key={name} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{name}</span>
                <span className="font-mono">
                  {r.right} / {r.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Review" className="flex flex-col gap-3">
        <div role="tablist" aria-label="Show" className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["wrong", "Wrong"],
              ["unanswered", "Skipped"],
              ["flagged", "Flagged"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={show === k}
              onClick={() => setShow(k)}
              className={`rounded-pill border px-3.5 py-1.5 text-sm font-semibold ${
                show === k ? "border-accent bg-surface-2" : "border-line text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {items.length === 0 && <p className="m-0 text-sm text-muted">Nothing here.</p>}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((i) => {
            const isOpen = open === i.position;
            return (
              <li key={i.position} className="lv-card p-3.5">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i.position)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span className="font-mono text-sm text-muted">{i.position + 1}</span>
                  <span className="line-clamp-2 min-w-0 flex-1 font-semibold">
                    {i.snapshot.stem}
                  </span>
                  <Badge
                    tone={
                      i.verdict === "correct"
                        ? "success"
                        : i.verdict === "wrong"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {i.verdict === "correct"
                      ? "Correct"
                      : i.verdict === "wrong"
                        ? "Wrong"
                        : "Skipped"}
                  </Badge>
                </button>
                {isOpen && (
                  <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
                    <p className="m-0 text-xs font-semibold text-muted">
                      {TYPE_LABELS[i.snapshot.qtype]}
                    </p>
                    <p className="m-0 whitespace-pre-wrap break-words">{i.snapshot.stem}</p>
                    <ResponseInput
                      snapshot={i.snapshot}
                      response={i.response}
                      onChange={() => undefined}
                      locked
                      reveal
                    />
                    {i.snapshot.explanation.trim() !== "" && (
                      <div className="rounded-control border border-line bg-surface-2 p-3.5">
                        <p className="m-0 mb-1 text-sm font-semibold">Explanation</p>
                        <p className="m-0 whitespace-pre-wrap break-words text-sm">
                          {i.snapshot.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
