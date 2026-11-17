import { memo } from "react";
import { Badge } from "../../../design-system/index.ts";
import { TYPE_LABELS } from "../domain/model.ts";
import type { QuestionRecord } from "../data/repo.ts";
import { DifficultyDots } from "./DifficultyDots.tsx";

interface Props {
  q: QuestionRecord;
  path: string[];
  selected: boolean;
  bookmarked: boolean;
  archive: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onBookmark: (id: string) => void;
}

/** One question in the list: select box, preview that opens the editor, and bookmark. */
export const QuestionRow = memo(function QuestionRow({
  q,
  path,
  selected,
  bookmarked,
  archive,
  onToggle,
  onOpen,
  onBookmark,
}: Props) {
  return (
    <li className="lv-card flex items-start gap-3 p-3.5">
      <input
        type="checkbox"
        aria-label={`Select: ${q.stem.slice(0, 60)}`}
        checked={selected}
        onChange={() => onToggle(q.id)}
        className="mt-1 size-4 shrink-0 accent-[var(--lv-accent)]"
      />
      <button
        type="button"
        onClick={() => onOpen(q.id)}
        className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
      >
        <span className="line-clamp-2 font-semibold">{q.stem}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Badge>{TYPE_LABELS[q.qtype]}</Badge>
          {path.length > 0 && <span>{path.join(" › ")}</span>}
          {q.difficulty !== null && <DifficultyDots level={q.difficulty} />}
          {q.tags.slice(0, 3).map((t) => (
            <Badge key={t} tone="accent">
              {t}
            </Badge>
          ))}
          {q.tags.length > 3 && <span>+{q.tags.length - 3}</span>}
        </span>
      </button>
      {!archive && (
        <button
          type="button"
          aria-label={`${bookmarked ? "Bookmarked" : "Bookmark"}: ${q.stem.slice(0, 40)}`}
          onClick={() => onBookmark(q.id)}
          className={`shrink-0 rounded-control border px-2.5 py-1 text-xs font-semibold ${
            bookmarked ? "border-accent bg-surface-2" : "border-line text-muted"
          }`}
        >
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </button>
      )}
    </li>
  );
});
