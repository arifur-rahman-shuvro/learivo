import { showToast } from "../../../core/toast.ts";
import { useIntent } from "../../../core/intents.ts";
import GlossaryText from "./GlossaryText.tsx";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  CheckIcon,
  EmptyState,
  QuestionsIcon,
  ReviewIcon,
  PanelSkeleton,
  CaughtUpScene,
  SavedScene,
} from "../../../ui-kit/index.ts";
import { errorText, useBank } from "../../question-bank/ui/bank.tsx";
import { usePractice, handoff } from "../../practice/ui/practice.tsx";
import { startFromQuestions } from "../../practice/ui/start.ts";
import type { Note } from "../data/repo.ts";
import type { QuestionRecord } from "../../question-bank/data/repo.ts";
import { isDue, review } from "../domain/scheduler.ts";
import FlashcardsPanel from "./FlashcardsPanel.tsx";
import GlossaryPanel from "./GlossaryPanel.tsx";
import NoteDialog from "./NoteDialog.tsx";
import { useWorkspace } from "./workspace.tsx";
import { List, DueNow, type Data } from "./ReviewParts.tsx";
import { inGroup, MISTAKE_GROUPS, type MistakeGroup } from "../../practice/domain/groups.ts";

/** The mistake groups plus the questions the student skipped. */
type Group = MistakeGroup | "skipped";
const GROUPS: readonly { id: Group; label: string }[] = [
  MISTAKE_GROUPS[0]!,
  { id: "skipped", label: "Skipped" },
  ...MISTAKE_GROUPS.slice(1),
];

type Tab = "due" | "mistakes" | "bookmarks" | "notes" | "flashcards" | "glossary";
const TABS: [Tab, string][] = [
  ["due", "Due now"],
  ["mistakes", "Mistakes"],
  ["bookmarks", "Bookmarks"],
  ["notes", "Notes"],
  ["flashcards", "Flashcards"],
  ["glossary", "Glossary"],
];

/** The active questions in one mistake group, from the loaded data. */
function questionsIn(data: Data | null, group: Group): QuestionRecord[] {
  if (group === "skipped")
    return [...(data?.skipped ?? [])]
      .filter((id) => data?.questions.get(id)?.status === "active")
      .map((id) => data!.questions.get(id)!);
  return [...(data?.past.entries() ?? [])]
    .filter(([id, p]) => inGroup(p, group) && data?.questions.get(id)?.status === "active")
    .map(([id]) => data!.questions.get(id)!);
}

export default function ReviewScreen({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { repo: bank, rev: bankRev } = useBank();
  const { attempts } = usePractice();
  const ws = useWorkspace();
  const [tab, setTab] = useState<Tab>("due");
  const [group, setGroup] = useState<Group>("wrong");
  useIntent((i) => {
    if (i.kind === "open" && TABS.some(([k]) => k === i.target)) setTab(i.target as Tab);
  });
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string>();
  const [noteSearch, setNoteSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteFor, setNoteFor] = useState<null | { questionId: string | null; note: Note | null }>(
    null,
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cards, marks, notes, past, skipped] = await Promise.all([
        ws.repo.cards(),
        ws.repo.bookmarks(),
        ws.repo.notes(),
        attempts.past(),
        attempts.skipped().catch(() => new Set<string>()),
      ]);
      const wrong = [...past.entries()]
        .filter(([, p]) => inGroup(p, "wrong") || inGroup(p, "shaky"))
        .map(([id]) => id);
      const ids = new Set<string>([
        ...cards.map((c) => c.questionId),
        ...marks,
        ...wrong,
        ...skipped,
        ...notes.flatMap((n) => (n.questionId ? [n.questionId] : [])),
      ]);
      const records = await bank.getMany([...ids]);
      return {
        cards,
        marks,
        notes,
        past,
        skipped,
        questions: new Map(records.map((q) => [q.id, q])),
      };
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
  const groupCounts = useMemo(
    () => new Map(GROUPS.map((g) => [g.id, questionsIn(data, g.id).length])),
    [data],
  );
  const mistakes = useMemo(() => questionsIn(data, group), [data, group]);
  // Missed and skipped questions, each counted once.
  const mistakeTotal = useMemo(
    () =>
      new Set([...questionsIn(data, "wrong"), ...questionsIn(data, "skipped")].map((q) => q.id))
        .size,
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
      if (done) showToast(done);
    } catch (e) {
      setError(errorText(e));
    }
  }

  const shownNotes = useMemo(() => {
    const needle = noteSearch.trim().toLowerCase();
    if (!data || needle === "") return data?.notes ?? [];
    return data.notes.filter((n) => {
      const q = n.questionId ? data.questions.get(n.questionId) : null;
      return `${n.title}\n${n.body}\n${q?.stem ?? ""}`.toLowerCase().includes(needle);
    });
  }, [data, noteSearch]);

  const counts: Record<Tab, number> = {
    due: due.length,
    mistakes: mistakeTotal,
    bookmarks: marked.length,
    notes: data?.notes.length ?? 0,
    flashcards: 0,
    glossary: 0,
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

      {error && (
        <p
          role="alert"
          className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {!data && !error && <PanelSkeleton />}

      {tab === "flashcards" && <FlashcardsPanel />}
      {tab === "glossary" && <GlossaryPanel />}

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
          {[...groupCounts.values()].some((n) => n > 0) && (
            <div role="tablist" aria-label="Group mistakes by" className="flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  role="tab"
                  type="button"
                  aria-selected={group === g.id}
                  onClick={() => setGroup(g.id)}
                  className={`rounded-pill border px-3.5 py-1.5 text-sm font-semibold ${
                    group === g.id ? "border-accent bg-surface-2" : "border-line text-muted"
                  }`}
                >
                  {g.label} <span className="font-mono">{groupCounts.get(g.id) ?? 0}</span>
                </button>
              ))}
            </div>
          )}
          {mistakes.length === 0 ? (
            <div className="lv-card">
              <EmptyState
                title={
                  group === "wrong"
                    ? "No mistakes to review"
                    : group === "skipped"
                      ? "Nothing skipped"
                      : "Nothing in this group"
                }
                icon={<CheckIcon size={36} />}
                art={group === "wrong" ? <CaughtUpScene /> : undefined}
                description={
                  group === "wrong"
                    ? "Questions you last answered wrong in a session appear here."
                    : group === "skipped"
                      ? "Questions you left unanswered the last time they came up appear here. Answer one and it leaves the list."
                      : "Tag why you missed a question in Results, or rate how sure you are while you practise, to fill these groups."
                }
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
                      `Practice: ${GROUPS.find((g) => g.id === group)?.label.toLowerCase() ?? "mistakes"}`,
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
                icon={<ReviewIcon size={36} />}
                art={<SavedScene />}
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
              icon={<QuestionsIcon size={36} />}
              art={<SavedScene />}
              description="Write a note on a question while you practise, or start a free note here."
              action={
                <Button onClick={() => setNoteFor({ questionId: null, note: null })}>
                  New note
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="note-search" className="sr-only">
                Search notes
              </label>
              <input
                id="note-search"
                type="search"
                className="lv-input"
                placeholder="Search notes"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
              />
            </div>
            {shownNotes.length === 0 && (
              <p className="m-0 text-sm text-muted">No notes match "{noteSearch.trim()}".</p>
            )}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {shownNotes.map((n) => {
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
                    <GlossaryText className="line-clamp-4 text-sm" text={n.body} />
                  </li>
                );
              })}
            </ul>
          </>
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
