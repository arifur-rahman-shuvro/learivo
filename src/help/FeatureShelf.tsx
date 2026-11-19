import { useState } from "react";
import { Button } from "../ui-kit/index.ts";
import { FeatureIcon } from "./FeatureIcon.tsx";
import { SHELF_FEATURES } from "./features.ts";
import { openFeature } from "./openFeature.ts";

const FIRST = 8;
const STEP = 8;

/** A short grid of feature buttons for Home. "More" reveals the next batch, "Fewer" folds it back. */
export default function FeatureShelf({
  onNavigate,
  onBrowse,
}: {
  onNavigate: (route: string) => void;
  /** Opens the full, searchable list. */
  onBrowse: () => void;
}) {
  const [count, setCount] = useState(FIRST);
  const total = SHELF_FEATURES.length;
  const all = count >= total;
  return (
    <section aria-label="All features" className="lv-card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-bold">All features</h2>
        <Button size="sm" variant="ghost" onClick={onBrowse}>
          Browse all features
        </Button>
      </div>
      <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-8">
        {SHELF_FEATURES.slice(0, count).map((f, i) => (
          <li key={f.id} className={i >= FIRST ? "lv-item-in" : undefined}>
            <button
              type="button"
              title={f.description}
              onClick={() => openFeature(f, onNavigate)}
              className="flex h-full w-full flex-col items-center gap-1.5 rounded-control border border-line bg-surface px-1 py-2.5 text-center hover:bg-surface-2 focus-visible:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-control bg-surface-2 text-accent"
              >
                <FeatureIcon name={f.icon} />
              </span>
              <span className="line-clamp-2 text-xs font-semibold leading-tight">{f.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setCount(all ? FIRST : Math.min(total, count + STEP))}
        >
          {all ? "Fewer" : `More (${total - count})`}
        </Button>
      </div>
    </section>
  );
}
