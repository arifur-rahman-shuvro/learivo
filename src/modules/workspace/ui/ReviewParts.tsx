import GlossaryText from "./GlossaryText.tsx";
import { useState } from "react";
import { Button, CaughtUpScene, CheckIcon, EmptyState } from "../../../ui-kit/index.ts";
import type { QuestionRecord } from "../../question-bank/data/repo.ts";
import { TYPE_LABELS } from "../../question-bank/domain/model.ts";
import ResponseInput from "../../practice/ui/ResponseInput.tsx";
import { grade, type Response } from "../../practice/domain/grading.ts";
import type { CardRecord, Note } from "../data/repo.ts";
import type { Past } from "../../practice/domain/session.ts";
import {
  RATINGS,
  RATING_LABEL,
  describeInterval,
  isDue,
  preview,
  type Rating,
} from "../domain/scheduler.ts";

export interface Data {
  cards: CardRecord[];
  marks: Set<string>;
  notes: Note[];
  past: Map<string, Past>;
  questions: Map<string, QuestionRecord>;
}

export function List({
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

export function DueNow({
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
          icon={<CheckIcon size={36} />}
          art={<CaughtUpScene />}
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
  const verdict = shown ? grade(q.qtype, q.answer, response).verdict : null;
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
              <GlossaryText className="text-sm" text={q.explanation} />
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
