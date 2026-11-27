import { useState } from "react";
import { Button, Picker } from "../../../../ui-kit/index.ts";
import { QUESTION_TYPES, TYPE_LABELS, type QuestionType } from "../../domain/model.ts";
import { type QuestionQuery } from "../../data/repo.ts";
import type { PickerOption } from "../../../../ui-kit/overlays/Picker.tsx";
import { SavedViews } from "../SavedViews.tsx";

interface Named {
  id: string;
  name: string;
}

interface Props {
  query: QuestionQuery;
  patch: (p: Partial<QuestionQuery>) => void;
  /** What is typed in the box, and the (slightly delayed) text the list is actually using. */
  searchText: string;
  search: string;
  setSearchText: (text: string) => void;
  options: readonly PickerOption[];
  tags: readonly Named[];
  collections: readonly Named[];
  filtered: boolean;
  clearFilters: () => void;
  /** True while questions are ticked: the bar stops sticking so the bulk bar can. */
  selecting: boolean;
}

/** The search box, the filter pickers (collapsible on a phone), active-filter chips and saved views. */
export function FilterBar({
  query,
  patch,
  searchText,
  search,
  setSearchText,
  options,
  tags,
  collections,
  filtered,
  clearFilters,
  selecting,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeChips: { id: string; label: string; clear: () => void }[] = [];
  if (search !== "") {
    activeChips.push({ id: "search", label: `"${search}"`, clear: () => setSearchText("") });
  }
  if (query.qtypes[0]) {
    activeChips.push({
      id: "type",
      label: TYPE_LABELS[query.qtypes[0]],
      clear: () => patch({ qtypes: [] }),
    });
  }
  if (query.unclassified) {
    activeChips.push({
      id: "subject",
      label: "Unclassified",
      clear: () => patch({ unclassified: false }),
    });
  } else if (query.nodeId) {
    activeChips.push({
      id: "subject",
      label: options.find((o) => o.value === query.nodeId)?.label ?? "Subject",
      clear: () => patch({ nodeId: null }),
    });
  }
  if (query.difficulties[0]) {
    activeChips.push({
      id: "difficulty",
      label: `Difficulty ${query.difficulties[0]}`,
      clear: () => patch({ difficulties: [] }),
    });
  }
  if (query.tagId) {
    activeChips.push({
      id: "tag",
      label: tags.find((t) => t.id === query.tagId)?.name ?? "Tag",
      clear: () => patch({ tagId: null }),
    });
  }
  if (query.collectionId) {
    activeChips.push({
      id: "collection",
      label: collections.find((c) => c.id === query.collectionId)?.name ?? "Collection",
      clear: () => patch({ collectionId: null }),
    });
  }

  return (
    <section
      aria-label="Search and filters"
      className={`lv-card flex flex-col gap-3 p-4 ${
        filtersOpen || selecting ? "" : "max-md:sticky max-md:top-2 max-md:z-10"
      }`}
    >
      <div className="flex gap-2">
        <input
          type="search"
          className="lv-input min-w-0 flex-1"
          aria-label="Search questions"
          placeholder="Search questions"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Button
          variant="secondary"
          className="md:hidden"
          aria-expanded={filtersOpen}
          aria-controls="question-filters"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          Filters{activeChips.length > 0 ? ` (${activeChips.length})` : ""}
        </Button>
      </div>
      {activeChips.length > 0 && (
        <ul aria-label="Active filters" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {activeChips.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                aria-label={`Remove filter: ${c.label}`}
                onClick={c.clear}
                className="inline-flex min-h-8 items-center gap-1 rounded-pill border border-line bg-surface-2 px-2.5 text-xs font-semibold"
              >
                {c.label}
                <span aria-hidden="true" className="text-muted">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* On a phone the filters open and close by height, not by popping in. */}
      <div
        className={`grid lv-t-smooth transition-[grid-template-rows,opacity,visibility] md:grid-rows-[1fr] ${
          filtersOpen
            ? "grid-rows-[1fr] opacity-100"
            : "invisible grid-rows-[0fr] opacity-0 md:visible md:opacity-100"
        }`}
      >
        <div
          id="question-filters"
          className="grid min-h-0 grid-cols-2 gap-2 max-md:overflow-hidden md:grid-cols-3 xl:grid-cols-6"
        >
          <Picker
            hideLabel
            label="Type"
            emptyLabel="All types"
            value={query.qtypes[0] ?? ""}
            options={QUESTION_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
            onChange={(v) => patch({ qtypes: v ? [v as QuestionType] : [] })}
          />
          <Picker
            hideLabel
            label="Subject"
            emptyLabel="All subjects"
            value={query.unclassified ? "__none" : (query.nodeId ?? "")}
            options={[{ value: "__none", label: "Unclassified" }, ...options]}
            onChange={(v) =>
              patch({ nodeId: v && v !== "__none" ? v : null, unclassified: v === "__none" })
            }
          />
          <Picker
            hideLabel
            label="Difficulty"
            emptyLabel="Any difficulty"
            value={query.difficulties[0] ? String(query.difficulties[0]) : ""}
            options={[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `Level ${d}` }))}
            onChange={(v) => patch({ difficulties: v ? [Number(v)] : [] })}
          />
          <Picker
            hideLabel
            label="Tag"
            emptyLabel="All tags"
            value={query.tagId ?? ""}
            options={tags.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(v) => patch({ tagId: v || null })}
          />
          <Picker
            hideLabel
            label="Collection"
            emptyLabel="All collections"
            value={query.collectionId ?? ""}
            options={collections.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => patch({ collectionId: v || null })}
          />
          <Picker
            hideLabel
            label="Sort"
            value={query.sort}
            options={[
              { value: "updated", label: "Last edited" },
              { value: "created", label: "Newest" },
              { value: "stem", label: "Alphabetical" },
            ]}
            onChange={(v) => patch({ sort: v as QuestionQuery["sort"] })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <SavedViews
          canSave={filtered}
          current={{
            search: searchText,
            nodeId: query.nodeId,
            unclassified: query.unclassified,
            qtypes: query.qtypes,
            difficulties: query.difficulties,
            tagId: query.tagId,
            collectionId: query.collectionId,
            sort: query.sort,
          }}
          onApply={(f) => {
            setSearchText(f.search);
            const { search: _s, ...rest } = f;
            void _s;
            patch(rest);
          }}
        />
      </div>
    </section>
  );
}
