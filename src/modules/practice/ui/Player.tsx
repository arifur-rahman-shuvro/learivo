import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, Spinner } from "../../../design-system/index.ts";
import { errorText } from "../../question-bank/ui/bank.tsx";
import { TYPE_LABELS } from "../../question-bank/domain/model.ts";
import type { AttemptWithItems } from "../data/repo.ts";
import { grade, isAnswered, marksFor, tally, type Response } from "../domain/grading.ts";
import ResponseInput, { stemParts } from "./ResponseInput.tsx";
import { clock, usePractice } from "./practice.tsx";
import NoteDialog from "../../workspace/ui/NoteDialog.tsx";
import { useWorkspace } from "../../workspace/ui/workspace.tsx";
import type { Note } from "../../workspace/data/repo.ts";

interface Props {
  attemptId: string;
  onLeave: () => void;
  onSubmitted: (attemptId: string) => void;
}

export default function Player({ attemptId, onLeave, onSubmitted }: Props) {
  const { attempts, refresh } = usePractice();
  const ws = useWorkspace();
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Note[]>([]);
  const [noting, setNoting] = useState(false);
  const [attempt, setAttempt] = useState<AttemptWithItems | null>(null);
  const [error, setError] = useState<string>();
  const [missing, setMissing] = useState(false);
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const opened = useRef(Date.now());
  const sent = useRef(false);

  useEffect(() => {
    let alive = true;
    attempts.get(attemptId).then(
      (a) => {
        if (!alive) return;
        if (!a || a.status === "submitted") return setMissing(true);
        setAttempt(a);
        if (a.instantFeedback) {
          setChecked(new Set(a.items.filter((i) => isAnswered(i.response)).map((i) => i.position)));
        }
        const firstOpen = a.items.findIndex((i) => !isAnswered(i.response));
        setIndex(firstOpen === -1 ? 0 : firstOpen);
      },
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [attempts, attemptId]);

  useEffect(() => {
    let alive = true;
    Promise.all([ws.repo.bookmarks(), ws.repo.notes()]).then(
      ([b, n]) => {
        if (!alive) return;
        setMarks(b);
        setNotes(n);
      },
      () => undefined, // bookmarks and notes are optional here; practice still works
    );
    return () => {
      alive = false;
    };
  }, [ws.repo, ws.rev]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const startedMs = attempt ? new Date(attempt.startedAt).getTime() : 0;
  const limit = attempt?.timeLimitSec ?? null;
  const remaining = limit === null ? null : limit - Math.floor((now - startedMs) / 1000);
  const spent =
    limit === null
      ? Math.floor((now - opened.current) / 1000)
      : Math.min(limit, limit - (remaining ?? 0));

  const submit = useCallback(
    async (a: AttemptWithItems) => {
      if (sent.current) return;
      sent.current = true;
      setBusy(true);
      setError(undefined);
      try {
        const verdicts = a.items.map((i) => grade(i.snapshot.qtype, i.snapshot.answer, i.response));
        const t = tally(verdicts, a.marksCorrect, a.marksWrong);
        await attempts.submit(
          a.id,
          verdicts.map((v, position) => ({
            position,
            verdict: v,
            marks: marksFor(v, a.marksCorrect, a.marksWrong),
          })),
          { ...t, secondsSpent: Math.max(0, spent) },
        );
        // Missed questions join the revision queue. A failure here must not lose the result.
        const missed = a.items.flatMap((i, k) =>
          verdicts[k] === "wrong" && i.questionId ? [i.questionId] : [],
        );
        if (missed.length > 0) await ws.repo.addCards(missed).catch(() => undefined);
        ws.refresh();
        refresh();
        onSubmitted(a.id);
      } catch (e) {
        sent.current = false;
        setError(errorText(e));
        setBusy(false);
        setConfirm(false);
      }
    },
    [attempts, refresh, onSubmitted, spent, ws],
  );

  // Time is up: hand in whatever has been answered.
  useEffect(() => {
    if (attempt && remaining !== null && remaining <= 0) void submit(attempt);
  }, [attempt, remaining, submit]);

  const item = attempt?.items[index];
  const answeredCount = useMemo(
    () => attempt?.items.filter((i) => isAnswered(i.response)).length ?? 0,
    [attempt],
  );

  if (missing)
    return (
      <div className="lv-card p-5" role="alert">
        <p className="m-0">This session is already finished or no longer exists.</p>
        <Button className="mt-3" onClick={onLeave}>
          Back to practice
        </Button>
      </div>
    );
  if (!attempt || !item)
    return (
      <div className="grid place-items-center py-16">
        {error ? <p role="alert">{error}</p> : <Spinner />}
      </div>
    );

  const locked = attempt.instantFeedback && checked.has(index);

  function change(position: number, response: Response | null) {
    setAttempt(
      (cur) =>
        cur && {
          ...cur,
          items: cur.items.map((i) => (i.position === position ? { ...i, response } : i)),
        },
    );
    attempts.patchItem(attemptId, position, { response }).catch((e) => setError(errorText(e)));
  }
  function flag(position: number) {
    const next = !attempt!.items[position]!.flagged;
    setAttempt(
      (cur) =>
        cur && {
          ...cur,
          items: cur.items.map((i) => (i.position === position ? { ...i, flagged: next } : i)),
        },
    );
    attempts.patchItem(attemptId, position, { flagged: next }).catch((e) => setError(errorText(e)));
  }

  const noteFor = item.questionId
    ? (notes.find((n) => n.questionId === item.questionId) ?? null)
    : null;
  async function toggleBookmark(qid: string) {
    const on = !marks.has(qid);
    setMarks((cur) => {
      const next = new Set(cur);
      if (on) next.add(qid);
      else next.delete(qid);
      return next;
    });
    try {
      await ws.repo.setBookmark(qid, on);
    } catch (e) {
      setError(errorText(e));
      ws.refresh();
    }
  }

  const total = attempt.items.length;
  const snap = item.snapshot;
  const parts = snap.qtype === "fill_blank" ? stemParts(snap.stem) : null;
  const unanswered = total - answeredCount;
  const lowTime = remaining !== null && remaining <= 60;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 id="module-title" className="m-0 truncate text-2xl font-bold">
            {attempt.title}
          </h1>
          <p className="m-0 text-sm text-muted">
            Question {index + 1} of {total} · {answeredCount} answered
          </p>
        </div>
        <div className="flex items-center gap-3">
          {remaining !== null && (
            <span
              role="timer"
              aria-label="Time left"
              className={`font-mono text-lg font-semibold ${lowTime ? "text-danger" : ""}`}
            >
              {clock(remaining)}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={onLeave}>
            Save and leave
          </Button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <section aria-label="Question" className="lv-card flex flex-col gap-4 p-5">
          <p className="m-0 text-xs font-semibold text-muted">
            {TYPE_LABELS[snap.qtype]}
            {snap.path.length > 0 ? ` · ${snap.path.join(" › ")}` : ""}
          </p>
          <p className="m-0 whitespace-pre-wrap break-words text-lg font-semibold leading-relaxed">
            {parts
              ? parts.map((p, i) => (
                  <span key={i}>
                    {p}
                    {i < parts.length - 1 && <span className="px-1 text-muted">[{i + 1}]</span>}
                  </span>
                ))
              : snap.stem}
          </p>
          <ResponseInput
            key={`${attemptId}-${index}`}
            snapshot={snap}
            response={item.response}
            onChange={(r) => change(index, r)}
            locked={locked}
            reveal={locked}
          />
          {locked && snap.explanation.trim() !== "" && (
            <div className="rounded-control border border-line bg-surface-2 p-3.5">
              <p className="m-0 mb-1 text-sm font-semibold">Explanation</p>
              <p className="m-0 whitespace-pre-wrap break-words text-sm">{snap.explanation}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {attempt.instantFeedback && !locked && (
              <Button
                disabled={!isAnswered(item.response)}
                onClick={() => setChecked((s) => new Set(s).add(index))}
              >
                Check answer
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => flag(index)}
              aria-pressed={item.flagged}
            >
              {item.flagged ? "Remove flag" : "Flag for review"}
            </Button>
            {item.questionId && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={marks.has(item.questionId)}
                  onClick={() => void toggleBookmark(item.questionId!)}
                >
                  {marks.has(item.questionId) ? "Bookmarked" : "Bookmark"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setNoting(true)}>
                  {noteFor ? "Edit note" : "Note"}
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
            <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              Previous
            </Button>
            {index < total - 1 ? (
              <Button onClick={() => setIndex(index + 1)}>Next</Button>
            ) : (
              <Button onClick={() => setConfirm(true)}>Finish</Button>
            )}
          </div>
        </section>

        <aside aria-label="Question list" className="lv-card flex flex-col gap-3 p-4 lg:self-start">
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {attempt.items.map((i) => {
              const done = isAnswered(i.response);
              const current = i.position === index;
              return (
                <button
                  key={i.position}
                  type="button"
                  aria-label={`Question ${i.position + 1}${done ? ", answered" : ""}${i.flagged ? ", flagged" : ""}`}
                  aria-current={current ? "true" : undefined}
                  onClick={() => setIndex(i.position)}
                  className={`relative grid h-9 place-items-center rounded-control border text-sm font-semibold ${
                    current ? "border-accent" : "border-line"
                  } ${done ? "bg-surface-3" : ""}`}
                >
                  {i.position + 1}
                  {i.flagged && (
                    <span
                      aria-hidden
                      className="absolute right-0.5 top-0.5 size-1.5 rounded-pill bg-accent"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Submit
          </Button>
        </aside>
      </div>

      {noting && item.questionId && (
        <NoteDialog
          questionId={item.questionId}
          about={snap.stem}
          note={noteFor}
          onClose={() => setNoting(false)}
        />
      )}

      <Dialog
        open={confirm}
        variant="modal"
        title="Submit now?"
        onClose={() => !busy && setConfirm(false)}
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>
              Keep working
            </Button>
            <Button loading={busy} onClick={() => void submit(attempt)}>
              Submit
            </Button>
          </>
        }
      >
        <p className="m-0">
          {unanswered === 0
            ? "You answered every question."
            : `${unanswered} question${unanswered === 1 ? " is" : "s are"} not answered and will score zero.`}{" "}
          After you submit you cannot change your answers.
        </p>
      </Dialog>
    </div>
  );
}
