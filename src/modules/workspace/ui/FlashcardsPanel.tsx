import GlossaryText from "./GlossaryText.tsx";
import { useEffect, useState } from "react";
import { Badge, Button, Dialog, EmptyState, ListSkeleton } from "../../../ui-kit/index.ts";
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

/** The student's own flashcards: write them, revise the due ones, rate how well they were recalled. */
export default function FlashcardsPanel() {
  const { repo, rev, refresh } = useWorkspace();
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<Flashcard | "new" | null>(null);
  const [shown, setShown] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const card = due[0];

  async function rate(c: Flashcard, r: Rating) {
    setSaving(true);
    try {
      await repo.rateFlashcard(c.id, review(c, r, new Date()));
      setShown(false);
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm text-muted" aria-live="polite">
          {cards === null
            ? "Loading cards"
            : `${cards.length} card${cards.length === 1 ? "" : "s"}, ${due.length} due`}
        </p>
        <Button onClick={() => setEditing("new")}>New card</Button>
      </div>
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
            description="Write a card with a question on the front and the answer on the back. Due cards come back on a schedule."
            action={<Button onClick={() => setEditing("new")}>Write your first card</Button>}
          />
        </div>
      )}
      {cards !== null && cards.length > 0 && !card && (
        <div className="lv-card">
          <EmptyState title="No cards due" description="Come back later, or add more cards." />
        </div>
      )}
      {card && (
        <section aria-label="Flashcard" className="lv-card flex flex-col gap-4 p-5">
          <GlossaryText className="text-lg font-semibold leading-relaxed" text={card.front} />
          {!shown ? (
            <div>
              <Button onClick={() => setShown(true)}>Show answer</Button>
            </div>
          ) : (
            <>
              <div className="rounded-control border border-line bg-surface-2 p-3.5">
                <GlossaryText text={card.back} />
              </div>
              <div
                role="group"
                aria-label="How well did you remember it?"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {RATINGS.map((r) => (
                  <Button
                    key={r}
                    variant={r === 3 ? "primary" : "secondary"}
                    disabled={saving}
                    className="flex-col"
                    onClick={() => void rate(card, r)}
                  >
                    <span>{RATING_LABEL[r]}</span>
                    <span className="text-xs font-normal opacity-80">
                      {describeInterval(preview(card, new Date())[r])}
                    </span>
                  </Button>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      {cards !== null && cards.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="All flashcards">
          {cards.map((c) => (
            <li key={c.id} className="lv-card flex items-start justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="m-0 line-clamp-2 break-words font-semibold">{c.front}</p>
                <p className="m-0 mt-0.5 line-clamp-2 break-words text-sm text-muted">{c.back}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isDue(c, now) && <Badge tone="accent">Due</Badge>}
                <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <CardDialog card={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
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
