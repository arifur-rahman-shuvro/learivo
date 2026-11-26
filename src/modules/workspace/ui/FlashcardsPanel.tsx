import GlossaryText from "./GlossaryText.tsx";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  CardsScene,
  Dialog,
  EmptyState,
  ListSkeleton,
  ProgressBar,
  Segmented,
} from "../../../ui-kit/index.ts";
import "./flashcards.css";
import { errorText } from "../../question-bank/ui/bank.tsx";
import type { Flashcard } from "../domain/cards.ts";
import {
  RATINGS,
  RATING_LABEL,
  describeInterval,
  isDue,
  preview,
  review,
  type Rating,
} from "../domain/scheduler.ts";
import { useWorkspace } from "./workspace.tsx";

type Filter = "all" | "due";

/** The student's own flashcards: a deck page with one big Study button, and a study mode. */
export default function FlashcardsPanel() {
  const { repo, rev, refresh } = useWorkspace();
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<Flashcard | "new" | null>(null);
  const [studying, setStudying] = useState<Flashcard[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    repo.flashcards().then(
      (list) => alive && (setCards(list), setError(undefined)),
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [repo, rev]);

  const now = new Date();
  const due = (cards ?? []).filter((c) => isDue(c, now)).sort((a, b) => a.due.localeCompare(b.due));
  const needle = search.trim().toLowerCase();
  const shown = (cards ?? []).filter(
    (c) =>
      (filter === "all" || isDue(c, now)) &&
      (needle === "" || `${c.front}\n${c.back}`.toLowerCase().includes(needle)),
  );

  if (studying)
    return (
      <StudyMode
        deck={studying}
        onRate={(c, r) => repo.rateFlashcard(c.id, review(c, r, new Date()))}
        onClose={() => {
          setStudying(null);
          refresh();
        }}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {cards === null && !error && <ListSkeleton />}
      {cards !== null && cards.length === 0 && (
        <div className="lv-card">
          <EmptyState
            title="No flashcards yet"
            art={<CardsScene />}
            description="Write a card with a question on the front and the answer on the back. Due cards come back on a schedule."
            action={<Button onClick={() => setEditing("new")}>Write your first card</Button>}
          />
        </div>
      )}
      {cards !== null && cards.length > 0 && (
        <section
          aria-label="Study"
          className="lv-card flex flex-col items-start gap-3 border-l-4 border-l-accent p-5"
        >
          <div>
            <h2 className="m-0 text-xl font-bold" aria-live="polite">
              {due.length > 0
                ? `${due.length} card${due.length === 1 ? "" : "s"} due`
                : "All caught up"}
            </h2>
            <p className="m-0 text-sm text-muted">
              {due.length > 0
                ? "Turn each card over, then say how well you remembered it."
                : `${cards.length} card${cards.length === 1 ? "" : "s"} in your deck. Come back later, or add more.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {due.length > 0 && (
              <Button size="lg" onClick={() => setStudying(due)}>
                {`Study ${due.length} card${due.length === 1 ? "" : "s"}`}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEditing("new")}>
              New card
            </Button>
          </div>
        </section>
      )}
      {cards !== null && cards.length > 0 && (
        <section aria-label="Your deck" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              className="lv-input min-w-0 flex-1"
              placeholder="Search your cards"
              aria-label="Search your cards"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Segmented
              label="Show"
              hideLabel
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: "all", label: `All ${cards.length}` },
                { value: "due", label: `Due ${due.length}` },
              ]}
            />
          </div>
          {shown.length === 0 ? (
            <p className="m-0 text-sm text-muted">No cards match.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="All flashcards">
              {shown.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="lv-card lv-card-interactive flex w-full items-start justify-between gap-3 p-3.5 text-left"
                  >
                    <span className="min-w-0">
                      <span className="line-clamp-2 block break-words font-semibold">
                        {c.front}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block break-words text-sm text-muted">
                        {c.back}
                      </span>
                    </span>
                    {isDue(c, now) && <Badge tone="accent">Due</Badge>}
                    <span className="sr-only">Tap to edit</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {editing && (
        <CardDialog card={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

/**
 * Full-screen study: one big card you tap to turn over, then four honest ratings that feed the
 * same schedule as before. Space turns the card, 1 to 4 rate it, Escape leaves.
 */
function StudyMode({
  deck,
  onRate,
  onClose,
}: {
  deck: Flashcard[];
  onRate: (c: Flashcard, r: Rating) => Promise<void>;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [tally, setTally] = useState<Record<Rating, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const done = i >= deck.length;
  const card = deck[i];

  async function rate(r: Rating) {
    if (!card || saving || !flipped) return;
    setSaving(true);
    setError(undefined);
    try {
      await onRate(card, r);
      setTally((t) => ({ ...t, [r]: t[r] + 1 }));
      setFlipped(false);
      setI((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (done) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "BUTTON" && e.key === " ") return; // a focused button handles Space itself
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && "1234".includes(e.key) && e.key.length === 1) {
        void rate(Number(e.key) as Rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const good = tally[3] + tally[4];
  return (
    <section
      aria-label="Flashcard"
      className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-bg p-4 sm:p-6"
    >
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <div className="min-w-0 flex-1">
          <ProgressBar
            value={(Math.min(i, deck.length) / deck.length) * 100}
            label="Cards studied"
          />
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">
          {Math.min(i + 1, deck.length)} / {deck.length}
        </span>
      </div>
      {error && (
        <p
          role="alert"
          className="m-0 mx-auto w-full max-w-2xl rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {done ? (
        <div className="lv-card mx-auto flex w-full max-w-2xl flex-col items-center gap-3 p-8 text-center">
          <CardsScene />
          <h2 className="m-0 text-2xl font-bold">Session done</h2>
          <p className="m-0 text-muted">
            {deck.length} card{deck.length === 1 ? "" : "s"} reviewed. {good} remembered well
            {tally[1] > 0 ? `, ${tally[1]} to see again soon` : ""}.
          </p>
          <Button size="lg" onClick={onClose}>
            Back to flashcards
          </Button>
        </div>
      ) : (
        card && (
          <>
            <div
              className="fc-card mx-auto max-w-2xl"
              data-flipped={flipped}
              onClick={() => setFlipped((f) => !f)}
            >
              <div className="fc-inner">
                <div className="fc-face lv-card" aria-hidden={flipped}>
                  <p className="m-0 text-xs font-semibold text-muted">Question</p>
                  <GlossaryText
                    className="text-xl font-semibold leading-relaxed"
                    text={card.front}
                  />
                  <p className="m-0 text-xs text-muted">Tap the card to turn it over</p>
                </div>
                <div className="fc-face fc-back lv-card" aria-hidden={!flipped}>
                  <p className="m-0 text-xs font-semibold text-muted">Answer</p>
                  <GlossaryText className="text-lg leading-relaxed" text={card.back} />
                </div>
              </div>
            </div>
            <div className="mx-auto w-full max-w-2xl">
              {!flipped ? (
                <Button size="lg" className="w-full" onClick={() => setFlipped(true)}>
                  Show answer
                </Button>
              ) : (
                <div
                  role="group"
                  aria-label="How well did you remember it?"
                  className="grid grid-cols-4 gap-2"
                >
                  {RATINGS.map((r) => (
                    <Button
                      key={r}
                      variant={r === 3 ? "primary" : "secondary"}
                      disabled={saving}
                      className="min-h-14 flex-col"
                      onClick={() => void rate(r)}
                    >
                      <span>{RATING_LABEL[r]}</span>
                      <span className="text-xs font-normal">
                        {describeInterval(preview(card, new Date())[r])}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
}

function CardDialog({ card, onClose }: { card: Flashcard | null; onClose: () => void }) {
  const { repo, refresh } = useWorkspace();
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await repo.saveFlashcard({ id: card?.id ?? null, front, back });
      refresh();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function remove() {
    if (!card) return;
    setBusy(true);
    try {
      await repo.deleteFlashcard(card.id);
      refresh();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      variant="drawer"
      title={card ? "Edit card" : "New card"}
      onClose={onClose}
      footer={
        <>
          {card && (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete card
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save card
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && (
          <p
            role="alert"
            className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Front
          <textarea
            className="lv-input"
            style={{ minHeight: "6rem" }}
            value={front}
            maxLength={2000}
            onChange={(e) => setFront(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Back
          <textarea
            className="lv-input"
            style={{ minHeight: "8rem" }}
            value={back}
            maxLength={5000}
            onChange={(e) => setBack(e.target.value)}
          />
        </label>
      </div>
    </Dialog>
  );
}
