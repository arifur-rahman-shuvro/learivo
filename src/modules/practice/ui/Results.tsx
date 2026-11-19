import { compareSentence, previousAttempt } from "../domain/compare.ts";
import { paceNote, paceOf, shortTime } from "../domain/pace.ts";
import GlossaryText from "../../workspace/ui/GlossaryText.tsx";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, ProgressRing, PanelSkeleton } from "../../../ui-kit/index.ts";
import { errorText } from "../../question-bank/ui/bank.tsx";
import { TYPE_LABELS } from "../../question-bank/domain/model.ts";
import type { AttemptWithItems } from "../data/repo.ts";
import { clock, usePractice } from "./practice.tsx";
import ResponseInput from "./ResponseInput.tsx";
import { startRetry } from "./start.ts";
import { REASONS, reasonLabel, type Reason } from "../domain/reasons.ts";
import { calibration, countCalibration } from "../domain/confidence.ts";

type Show = "all" | "wrong" | "unanswered" | "flagged" | "overconfident" | "shaky";

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
  const [versus, setVersus] = useState<string | null>(null);

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

  // An exam taken before is compared with its latest earlier attempt.
  useEffect(() => {
    if (!a || a.kind !== "exam" || !a.examId) return;
    let alive = true;
    attempts.list(200).then(
      (all) => {
        const same = all.filter((x) => x.examId === a.examId && x.status === "submitted");
        const cur = same.find((x) => x.id === a.id);
        const prev = cur ? previousAttempt(cur, same) : null;
        if (alive && cur && prev) setVersus(compareSentence(cur, prev));
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [a, attempts]);

  const pace = useMemo(
    () =>
      paceOf(
        (a?.items ?? []).map((i) => ({
          position: i.position,
          seconds: i.seconds,
          verdict: i.verdict,
        })),
      ),
    [a],
  );

  const bySubject = useMemo(() => {
    const map = new Map<string, { right: number; total: number }>();
    for (const i of a?.items ?? []) {
      const name = i.snapshot.path[0] ?? "Unclassified";
      const row = map.get(name) ?? { right: 0, total: 0 };
      row.total += 1;
      row.right += i.credit ?? (i.verdict === "correct" ? 1 : 0);
      map.set(name, row);
    }
    return [...map.entries()].sort((x, y) => y[1].total - x[1].total);
  }, [a]);

  if (error) return <p role="alert">{error}</p>;
  if (!a) return <PanelSkeleton />;

  const items = a.items.filter(
    (i) =>
      show === "all" ||
      (show === "wrong" && (i.verdict === "wrong" || i.verdict === "partial")) ||
      (show === "unanswered" && i.verdict === "unanswered") ||
      (show === "flagged" && i.flagged) ||
      (show === "overconfident" &&
        calibration(i.verdict === "correct", i.confidence) === "overconfident" &&
        i.verdict !== "unanswered") ||
      (show === "shaky" && calibration(i.verdict === "correct", i.confidence) === "shaky"),
  );
  const sureness = countCalibration(
    a.items
      .filter((i) => i.verdict !== "unanswered")
      .map((i) => ({ correct: i.verdict === "correct", confidence: i.confidence })),
  );
  const answered = (a.correct ?? 0) + (a.partial ?? 0) + (a.wrong ?? 0);
  const earned = a.items.reduce((n, i) => n + (i.credit ?? (i.verdict === "correct" ? 1 : 0)), 0);
  const percent = a.questionCount === 0 ? 0 : (earned / a.questionCount) * 100;
  const answeredCredit = a.items.reduce(
    (n, i) =>
      i.verdict === "unanswered" ? n : n + (i.credit ?? (i.verdict === "correct" ? 1 : 0)),
    0,
  );
  const missed = a.items.some((i) => i.verdict !== "correct" && i.questionId !== null);

  async function setReason(position: number, reason: Reason | null) {
    const before = a!;
    setA({
      ...before,
      items: before.items.map((i) =>
        i.position === position ? { ...i, mistakeReason: reason } : i,
      ),
    });
    try {
      await attempts.patchItem(attemptId, position, { mistakeReason: reason });
    } catch (e) {
      setA(before);
      setError(errorText(e));
    }
  }

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
        {versus && (
          <p role="status" className="m-0 w-full text-sm font-semibold sm:order-last">
            {versus}
          </p>
        )}
        <dl className="m-0 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
          {[
            ["Score", `${a.score ?? 0} / ${a.questionCount * a.marksCorrect}`],
            ["Correct", String(a.correct ?? 0)],
            ["Partly correct", String(a.partial ?? 0)],
            ["Wrong", String(a.wrong ?? 0)],
            ["Skipped", String(a.unanswered ?? 0)],
            [
              "Accuracy",
              answered === 0 ? "-" : `${Math.round((answeredCredit / answered) * 100)}%`,
            ],
            ["Time", clock(a.secondsSpent)],
            ...(pace ? [["Per question", shortTime(pace.average)]] : []),
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold text-muted">{k}</dt>
              <dd className="m-0 text-xl font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {sureness.rated > 0 && (
        <section aria-label="Confidence" className="lv-card flex flex-col gap-2 p-5">
          <h2 className="m-0 text-lg font-semibold">How sure you were</h2>
          <p className="m-0 text-sm text-muted">
            You rated {sureness.rated} of {answered} answers.
          </p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            <li>
              <strong>{sureness.overconfident}</strong> sure but wrong
              {sureness.overconfident > 0 ? ": a wrong belief, fix these first." : "."}
            </li>
            <li>
              <strong>{sureness.shaky}</strong> right but unsure
              {sureness.shaky > 0 ? ": could be luck, worth a revisit." : "."}
            </li>
            <li>
              <strong>{sureness.solid}</strong> sure and right, <strong>{sureness.gap}</strong>{" "}
              wrong and unsure.
            </li>
          </ul>
        </section>
      )}

      {pace && (pace.slowest.length > 0 || paceNote(pace)) && (
        <section aria-label="Pace" className="lv-card flex flex-col gap-3 p-5">
          <h2 className="m-0 text-lg font-semibold">Pace</h2>
          {paceNote(pace) && <p className="m-0 text-sm">{paceNote(pace)}</p>}
          {pace.slowest.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {pace.slowest.map((x) => (
                <li key={x.position}>
                  <button
                    type="button"
                    onClick={() => {
                      setShow("all");
                      setOpen(x.position);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-control text-left text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-muted">{x.position + 1}</span>{" "}
                      {a.items[x.position]?.snapshot.stem}
                    </span>
                    <span className="shrink-0 font-mono font-semibold">{shortTime(x.seconds)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
              ...((sureness.overconfident > 0 ? [["overconfident", "Sure but wrong"]] : []) as [
                Show,
                string,
              ][]),
              ...((sureness.shaky > 0 ? [["shaky", "Right but unsure"]] : []) as [Show, string][]),
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
                        : i.verdict === "partial"
                          ? "warning"
                          : i.verdict === "wrong"
                            ? "danger"
                            : "neutral"
                    }
                  >
                    {i.verdict === "correct"
                      ? "Correct"
                      : i.verdict === "partial"
                        ? "Partly correct"
                        : i.verdict === "wrong"
                          ? "Wrong"
                          : "Skipped"}
                    {i.verdict !== "unanswered" && i.marks !== null ? ` · ${i.marks}` : ""}
                  </Badge>
                  {i.mistakeReason && <Badge tone="neutral">{reasonLabel(i.mistakeReason)}</Badge>}
                  {calibration(i.verdict === "correct", i.confidence) === "overconfident" &&
                    i.verdict !== "unanswered" && <Badge tone="danger">Sure but wrong</Badge>}
                  {calibration(i.verdict === "correct", i.confidence) === "shaky" && (
                    <Badge tone="warning">Right but unsure</Badge>
                  )}
                  {i.seconds > 0 && (
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {shortTime(i.seconds)}
                    </span>
                  )}
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
                    {(i.verdict === "wrong" || i.verdict === "partial") && (
                      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                        <legend className="mb-1 text-sm font-semibold">Why did you miss it?</legend>
                        <div
                          role="radiogroup"
                          aria-label="Why did you miss it?"
                          className="flex flex-wrap gap-2"
                        >
                          {REASONS.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              role="radio"
                              aria-checked={i.mistakeReason === r.id}
                              title={r.hint}
                              onClick={() =>
                                void setReason(i.position, i.mistakeReason === r.id ? null : r.id)
                              }
                              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                                i.mistakeReason === r.id
                                  ? "border-[var(--lv-accent)] bg-[var(--lv-accent)] text-white"
                                  : "border-line bg-surface hover:bg-surface-2"
                              }`}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                        <p className="m-0 text-xs text-muted">
                          Only you see this. Insights uses it to show where your marks go.
                        </p>
                      </fieldset>
                    )}
                    {i.snapshot.explanation.trim() !== "" && (
                      <div className="rounded-control border border-line bg-surface-2 p-3.5">
                        <p className="m-0 mb-1 text-sm font-semibold">Explanation</p>
                        <GlossaryText className="text-sm" text={i.snapshot.explanation} />
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
