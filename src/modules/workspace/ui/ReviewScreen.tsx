import { useEffect, useMemo, useState } from "react";
import { Badge, Button, EmptyState, Spinner } from "../../../design-system/index.ts";
import type { QuestionRecord } from "../../question-bank/data/repo.ts";
import { TYPE_LABELS } from "../../question-bank/domain/model.ts";
import { errorText, useBank } from "../../question-bank/ui/bank.tsx";
import { usePractice, handoff } from "../../practice/ui/practice.tsx";
import { startFromQuestions } from "../../practice/ui/start.ts";
import ResponseInput from "../../practice/ui/ResponseInput.tsx";
import { grade, type Response } from "../../practice/domain/grading.ts";
import type { Past } from "../../practice/domain/session.ts";
import type { CardRecord, Note } from "../data/repo.ts";
import {
  RATINGS,
  RATING_LABEL,
  describeInterval,
  isDue,
  preview,
  review,
  type Rating,
} from "../domain/scheduler.ts";
import NoteDialog from "./NoteDialog.tsx";
import { useWorkspace } from "./workspace.tsx";

type Tab = "due" | "mistakes" | "bookmarks" | "notes";
const TABS: [Tab, string][] = [
  ["due", "Due now"],
  ["mistakes", "Mistakes"],
  ["bookmarks", "Bookmarks"],
  ["notes", "Notes"],
];

interface Data {
  cards: CardRecord[];
  marks: Set<string>;
  notes: Note[];
  past: Map<string, Past>;
  questions: Map<string, QuestionRecord>;
}

export default function ReviewScreen({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { repo: bank, rev: bankRev } = useBank();
  const { attempts } = usePractice();
  const ws = useWorkspace();
  const [tab, setTab] = useState<Tab>("due");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [noteFor, setNoteFor] = useState<null | { questionId: string | null; note: Note | null }>(
    null,
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cards, marks, notes, past] = await Promise.all([
        ws.repo.cards(),
        ws.repo.bookmarks(),
        ws.repo.notes(),
        attempts.past(),
      ]);
      const wrong = [...past.entries()].filter(([, p]) => p.last === "wrong").map(([id]) => id);
      const ids = new Set<string>([
        ...cards.map((c) => c.questionId),
        ...marks,
        ...wrong,
        ...notes.flatMap((n) => (n.questionId ? [n.questionId] : [])),
      ]);
      const records = await bank.getMany([...ids]);
      return { cards, marks, notes, past, questions: new Map(records.map((q) => [q.id, q])) };
    })().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(undefined);
      },
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [ws.repo, ws.rev, bank, bankRev, attempts]);

  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const due = useMemo(
    () =>
      (data?.cards ?? [])
        .filter((c) => isDue(c, now) && data?.questions.has(c.questionId))
        .sort((a, b) => a.due.localeCompare(b.due)),
    [data, now],
  );
  const mistakes = useMemo(
    () =>
      [...(data?.past.entries() ?? [])]
        .filter(([id, p]) => p.last === "wrong" && data?.questions.get(id)?.status === "active")
        .map(([id]) => data!.questions.get(id)!),
    [data],
  );
  const marked = useMemo(
    () =>
      [...(data?.marks ?? [])].flatMap((id) =>
        data?.questions.get(id) ? [data.questions.get(id)!] : [],
      ),
    [data],
  );

  async function practise(ids: string[], title: string) {
    setBusy(true);
    setError(undefined);
    try {
      handoff.attemptId = await startFromQuestions(bank, attempts, ids, title);
      onNavigate("#/practice");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<void>, done?: string) {
    setError(undefined);
    try {
      await fn();
      ws.refresh();
      if (done) setNotice(done);
    } catch (e) {
      setError(errorText(e));
    }
  }

  const counts: Record<Tab, number> = {
    due: due.length,
    mistakes: mistakes.length,
    bookmarks: marked.length,
    notes: data?.notes.length ?? 0,
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="module-title" className="m-0 text-3xl font-bold">
            Review
          </h1>
          <p className="m-0 text-sm text-muted">Revise what you missed, and keep what you saved.</p>
        </div>
        {tab === "notes" && (
          <Button onClick={() => setNoteFor({ questionId: null, note: null })}>New note</Button>
        )}
      </header>

      <div
        role="tablist"
        aria-label="Review sections"
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k);
              setNotice(undefined);
            }}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === k ? "border-accent text-fg" : "border-transparent text-muted"
            }`}
          >
            {label}
            {data && counts[k] > 0 && (
              <Badge tone={k === "due" ? "accent" : "neutral"}>{counts[k]}</Badge>
            )}
          </button>
        ))}
      </div>

      {notice && (
        <p
          role="status"
          className="m-0 rounded-control border border-line bg-surface-2 px-3 py-2 text-sm font-medium"
        >
          {notice}
        </p>
      )}
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

      {data && tab === "due" && (
        <DueNow
          key={due[0]?.questionId ?? "none"}
          due={due}
          data={data}
          onRate={(c, r) => act(() => ws.repo.saveCard(c.questionId, review(c, r, new Date())))}
          onPractise={() => onNavigate("#/practice")}
        />
      )}

      {data && tab === "mistakes" && (
        <>
          {mistakes.length === 0 ? (
            <div className="lv-card">
              <EmptyState
                title="No mistakes to review"
                description="Questions you last answered wrong in a session appear here."
              />
            </div>
          ) : (
            <>
              <div>
                <Button
                  loading={busy}
                  onClick={() =>
                    void practise(
                      mistakes.map((q) => q.id),
                      "Practice: my mistakes",
                    )
                  }
                >
                  Practise these {Math.min(mistakes.length, 200)}
                </Button>
              </div>
              <List
                items={mistakes}
                render={(q) => {
                  const has = data.cards.some((c) => c.questionId === q.id);
                  return has ? (
                    <Badge>In revision</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void act(() => ws.repo.addCards([q.id]), "Added to revision.")}
                    >
                      Add to revision
                    </Button>
                  );
                }}
              />
            </>
          )}
        </>
      )}

      {data && tab === "bookmarks" && (
        <>
          {marked.length === 0 ? (
            <div className="lv-card">
              <EmptyState
                title="No bookmarks yet"
                description="Tap Bookmark on a question while you practise to keep it here."
              />
            </div>
          ) : (
            <>
              <div>
                <Button
                  loading={busy}
                  onClick={() =>
                    void practise(
                      marked.map((q) => q.id),
                      "Practice: bookmarks",
                    )
                  }
                >
                  Practise bookmarked
                </Button>
              </div>
              <List
                items={marked}
                render={(q) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void act(() => ws.repo.setBookmark(q.id, false), "Bookmark removed.")
                    }
                  >
                    Remove bookmark
                  </Button>
                )}
              />
            </>
          )}
        </>
      )}

      {data &&
        tab === "notes" &&
        (data.notes.length === 0 ? (
          <div className="lv-card">
            <EmptyState
              title="No notes yet"
              description="Write a note on a question while you practise, or start a free note here."
              action={
                <Button onClick={() => setNoteFor({ questionId: null, note: null })}>
                  New note
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.notes.map((n) => {
              const q = n.questionId ? data.questions.get(n.questionId) : null;
              return (
                <li key={n.id} className="lv-card flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 truncate font-semibold">
                        {n.title || (q ? q.stem : "Note")}
                      </p>
                      {q && n.title && (
                        <p className="m-0 line-clamp-1 text-xs text-muted">{q.stem}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setNoteFor({ questionId: n.questionId, note: n })}
                    >
                      Edit
                    </Button>
                  </div>
                  <p className="m-0 line-clamp-4 whitespace-pre-wrap break-words text-sm">
                    {n.body}
                  </p>
                </li>
              );
            })}
          </ul>
        ))}

      {noteFor && (
        <NoteDialog
          questionId={noteFor.questionId}
          about={noteFor.questionId ? data?.questions.get(noteFor.questionId)?.stem : undefined}
          note={noteFor.note}
          onClose={() => setNoteFor(null)}
        />
      )}
    </div>
  );
}

function List({
  items,
  render,
}: {
  items: QuestionRecord[];
  render: (q: QuestionRecord) => React.ReactNode;
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {items.slice(0, 200).map((q) => (
        <li key={q.id} className="lv-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="m-0 line-clamp-2 font-semibold">{q.stem}</p>
            <p className="m-0 text-xs text-muted">{TYPE_LABELS[q.qtype]}</p>
          </div>
          {render(q)}
        </li>
      ))}
    </ul>
  );
}

function DueNow({
  due,
  data,
  onRate,
  onPractise,
}: {
  due: CardRecord[];
  data: Data;
  onRate: (card: CardRecord, rating: Rating) => Promise<void>;
  onPractise: () => void;
}) {
  const card = due[0];
  const q = card ? data.questions.get(card.questionId) : undefined;
  const [response, setResponse] = useState<Response | null>(null);
  const [shown, setShown] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!card || !q) {
    const next = data.cards
      .filter((c) => !isDue(c, new Date()))
      .sort((a, b) => a.due.localeCompare(b.due))[0];
    return (
      <div className="lv-card">
        <EmptyState
          title="You are all caught up"
          description={
            next
              ? `Next card is due ${new Date(next.due).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}. Questions you miss in a session join the queue by themselves.`
              : "Questions you miss in a session join this queue by themselves."
          }
          action={<Button onClick={onPractise}>Go to practice</Button>}
        />
      </div>
    );
  }

  const snapshot = {
    qtype: q.qtype,
    stem: q.stem,
    explanation: q.explanation,
    answer: q.answer,
    difficulty: q.difficulty,
    path: [],
  };
  const verdict = shown ? grade(q.qtype, q.answer, response) : null;
  const suggested: Rating = verdict === "correct" ? 3 : 1;
  const times = preview(card, new Date());

  return (
    <section aria-label="Revision card" className="lv-card flex flex-col gap-4 p-5">
      <p className="m-0 text-sm text-muted" aria-live="polite">
        {due.length} card{due.length === 1 ? "" : "s"} due
      </p>
      <p className="m-0 whitespace-pre-wrap break-words text-lg font-semibold leading-relaxed">
        {q.stem}
      </p>
      <ResponseInput
        key={card.questionId}
        snapshot={snapshot}
        response={response}
        onChange={setResponse}
        locked={shown}
        reveal={shown}
      />
      {!shown ? (
        <div>
          <Button onClick={() => setShown(true)}>Show answer</Button>
        </div>
      ) : (
        <>
          {q.explanation.trim() !== "" && (
            <div className="rounded-control border border-line bg-surface-2 p-3.5">
              <p className="m-0 mb-1 text-sm font-semibold">Explanation</p>
              <p className="m-0 whitespace-pre-wrap break-words text-sm">{q.explanation}</p>
            </div>
          )}
          <div
            role="group"
            aria-label="How well did you remember it?"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {RATINGS.map((r) => (
              <Button
                key={r}
                variant={r === suggested ? "primary" : "secondary"}
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  await onRate(card, r);
                  setSaving(false);
                  setShown(false);
                  setResponse(null);
                }}
                className="flex-col"
              >
                <span>{RATING_LABEL[r]}</span>
                <span className="text-xs font-normal opacity-80">{describeInterval(times[r])}</span>
              </Button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
