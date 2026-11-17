import { useState } from "react";
import { Button, Picker } from "../../../design-system/index.ts";
import type { QuestionQuery } from "../data/repo.ts";

/** The filters a student can save under a name. Page position is not part of a view. */
export interface ViewFilters {
  search: string;
  nodeId: string | null;
  unclassified: boolean;
  qtypes: QuestionQuery["qtypes"];
  difficulties: number[];
  tagId: string | null;
  collectionId: string | null;
  sort: QuestionQuery["sort"];
}

export interface SavedView {
  name: string;
  filters: ViewFilters;
}

const KEY = "learivo.savedViews";
const MAX_VIEWS = 20;

export function loadViews(): SavedView[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (v): v is SavedView =>
          !!v && typeof v.name === "string" && !!v.filters && typeof v.filters === "object",
      )
      .slice(0, MAX_VIEWS);
  } catch {
    return [];
  }
}

function storeViews(views: SavedView[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(views));
  } catch {
    // Saved views are a convenience; the filters still work without them.
  }
}

/** Adds or replaces a view with the same name (ignoring case). */
export function withView(views: SavedView[], view: SavedView): SavedView[] {
  const name = view.name.trim().slice(0, 40);
  if (name === "") return views;
  const rest = views.filter((v) => v.name.toLowerCase() !== name.toLowerCase());
  return [...rest, { ...view, name }].slice(-MAX_VIEWS);
}

export function SavedViews({
  current,
  canSave,
  onApply,
}: {
  current: ViewFilters;
  /** False when no filter is set, so there is nothing worth saving. */
  canSave: boolean;
  onApply: (f: ViewFilters) => void;
}) {
  const [views, setViews] = useState<SavedView[]>(loadViews);
  const [selected, setSelected] = useState("");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const update = (next: SavedView[]) => {
    setViews(next);
    storeViews(next);
  };

  if (views.length === 0 && !canSave) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.length > 0 && (
        <>
          <Picker
            hideLabel
            className="max-w-56"
            label="Saved views"
            emptyLabel="Saved views"
            value={selected}
            options={views.map((v) => ({ value: v.name, label: v.name }))}
            onChange={(name) => {
              const v = views.find((x) => x.name === name);
              setSelected(name);
              if (v) onApply(v.filters);
            }}
          />
          {selected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                update(views.filter((v) => v.name !== selected));
                setSelected("");
              }}
            >
              Delete view
            </Button>
          )}
        </>
      )}
      {canSave &&
        (naming ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const next = withView(views, { name, filters: current });
              if (next !== views) {
                update(next);
                setSelected(name.trim().slice(0, 40));
              }
              setNaming(false);
              setName("");
            }}
          >
            <input
              className="lv-input w-44"
              aria-label="View name"
              placeholder="Name this view"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button size="sm" type="submit" disabled={name.trim() === ""}>
              Save
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => setNaming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setNaming(true)}>
            Save this view
          </Button>
        ))}
    </div>
  );
}
