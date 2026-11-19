import { useRequestFocus } from "../../../app/focus.ts";
import GlossaryText from "../../workspace/ui/GlossaryText.tsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, ProgressBar, Spinner } from "../../../ui-kit/index.ts";
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
  useRequestFocus();
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
  const [grid, setGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const opened = useRef(Date.now());
  const sent = useRef(false);
  const flagRef = useRef<(() => void) | null>(null);
  // Seconds on each question, counted only while the page is visible.
  const secs = useRef<number[]>([]);
  const indexRef = useRef(0);
  indexRef.current = index;

  useEffect(() => {
    let alive = true;
    attempts.get(attemptId).then(
      (a) => {
        if (!alive) return;
        if (!a || a.status === "submitted") return setMissing(true);
        setAttempt(a);
        secs.current = a.items.map((i) => i.seconds);
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

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      secs.current[indexRef.current] = (secs.current[indexRef.current] ?? 0) + 1;
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Leaving a question saves its time, so a closed tab does not lose it.
  useEffect(() => {
    return () => {
      const left = secs.current[index];
      if (left) attempts.patchItem(attemptId, index, { seconds: left }).catch(() => undefined);
    };
  }, [index, attempts, attemptId]);

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
            verdict: v.verdict,
            credit: v.credit,
            marks: marksFor(v, a.marksCorrect, a.marksWrong),
            seconds: secs.current[position] ?? 0,
          })),
          { ...t, secondsSpent: Math.max(0, spent) },
        );
        // Missed questions join the revision queue. A failure here must not lose the result.
        const missed = a.items.flatMap((i, k) =>
          verdicts[k]!.verdict !== "correct" &&
          verdicts[k]!.verdict !== "unanswered" &&
          i.questionId
            ? [i.questionId]
            : [],
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

  // Desktop shortcuts: N or right arrow for next, P or left arrow for previous, F to flag.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (!attempt) return;
      const last = attempt.items.length - 1;
      const k = e.key.toLowerCase();
      if (k === "n" || k === "arrowright") setIndex((i) => Math.min(last, i + 1));
      else if (k === "p" || k === "arrowleft") setIndex((i) => Math.max(0, i - 1));
      else if (k === "f") flagRef.current?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attempt]);

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

  flagRef.current = () => flag(index);
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
          <h1 id="module-title" className="m-0 truncate text-xl font-bold sm:text-2xl">
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
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setGrid(true)}>
            Questions
          </Button>
          <Button variant="secondary" size="sm" onClick={onLeave}>
            Save and leave
          </Button>
        </div>
      </header>
      <ProgressBar
        value={(answeredCount / total) * 100}
        label={`${answeredCount} of ${total} answered`}
      />

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
          <p className="m-0 flex items-baseline justify-between gap-3 text-xs font-semibold text-muted">
            <span className="min-w-0">
              {TYPE_LABELS[snap.qtype]}
              {snap.path.length > 0 ? ` · ${snap.path.join(" › ")}` : ""}
            </span>
            <span className="shrink-0 font-mono" title="Time on this question">
              {clock(secs.current[index] ?? 0)}
            </span>
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
              <GlossaryText className="text-sm" text={snap.explanation} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <IconToggle
              label={item.flagged ? "Remove flag" : "Flag for review"}
              text="Flag"
              pressed={item.flagged}
              onClick={() => flag(index)}
              path="M5 3v18M5 4h11l-2 4 2 4H5"
            />
            {item.questionId && (
              <>
                <IconToggle
                  label={marks.has(item.questionId) ? "Bookmarked" : "Bookmark"}
                  text="Save"
                  pressed={marks.has(item.questionId)}
                  onClick={() => void toggleBookmark(item.questionId!)}
                  path="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"
                />
                <IconToggle
                  label={noteFor ? "Edit note" : "Note"}
                  text={noteFor ? "Note ✓" : "Note"}
                  pressed={Boolean(noteFor)}
                  onClick={() => setNoting(true)}
                  path="M5 4h14v12l-4 4H5V4Zm9 16v-4h4M8 9h8M8 13h5"
                />
              </>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-1 p-3 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pt-4 lg:px-0 lg:pb-0">
            <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              Previous
            </Button>
            {attempt.instantFeedback && !locked && (
              <Button
                disabled={!isAnswered(item.response)}
                onClick={() => setChecked((s) => new Set(s).add(index))}
              >
                Check answer
              </Button>
            )}
            {index < total - 1 ? (
              <Button
                variant={attempt.instantFeedback && !locked ? "secondary" : "primary"}
                onClick={() => setIndex(index + 1)}
              >
                Next
              </Button>
            ) : (
              <Button onClick={() => setConfirm(true)}>Finish</Button>
            )}
          </div>
        </section>

        <aside
          aria-label="Question list"
          className="lv-card flex flex-col gap-3 p-4 max-lg:hidden lg:self-start"
        >
          <QuestionGrid items={attempt.items} index={index} onPick={setIndex} />
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Submit
          </Button>
        </aside>
      </div>

      <Dialog open={grid} variant="drawer" title="Questions" onClose={() => setGrid(false)}>
        <div className="flex flex-col gap-3">
          <QuestionGrid
            items={attempt.items}
            index={index}
            onPick={(i) => {
              setIndex(i);
              setGrid(false);
            }}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setGrid(false);
              setConfirm(true);
            }}
          >
            Submit
          </Button>
        </div>
      </Dialog>

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

function IconToggle({
  label,
  text,
  pressed,
  onClick,
  path,
}: {
  label: string;
  text: string;
  pressed: boolean;
  onClick: () => void;
  path: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold ${
        pressed ? "bg-surface-3 text-accent" : "text-muted"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={pressed ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
      <span aria-hidden="true">{text}</span>
    </button>
  );
}

function QuestionGrid({
  items,
  index,
  onPick,
}: {
  items: AttemptWithItems["items"];
  index: number;
  onPick: (position: number) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
      {items.map((i) => {
        const done = isAnswered(i.response);
        const current = i.position === index;
        return (
          <button
            key={i.position}
            type="button"
            aria-label={`Question ${i.position + 1}${done ? ", answered" : ""}${i.flagged ? ", flagged" : ""}`}
            aria-current={current ? "true" : undefined}
            onClick={() => onPick(i.position)}
            className={`relative grid h-11 place-items-center rounded-control border text-sm font-semibold ${
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
  );
}
