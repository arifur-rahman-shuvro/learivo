import { showToast } from "../../../app/toast.ts";
import { QuestionRow } from "./QuestionRow.tsx";
import { DuplicatesDialog } from "./DuplicatesDialog.tsx";
import { SavedViews } from "./SavedViews.tsx";
import AddHub, { type AddChoice } from "./AddHub.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntent } from "../../../app/intents.ts";
import {
  Button,
  Dialog,
  EmptyState,
  ListSkeleton,
  PlusIcon,
  QuestionsIcon,
  SearchIcon,
} from "../../../design-system/index.ts";
import { QUESTION_TYPES, TYPE_LABELS, type QuestionType } from "../domain/model.ts";
import {
  DEFAULT_QUERY,
  KIND_BY_DEPTH,
  pathOf,
  type BulkAction,
  type QuestionQuery,
  type QuestionRecord,
  type TaxonomyNode,
} from "../data/repo.ts";
import { ImportDialog } from "./ImportExportDialogs.tsx";
import { ExportDialog } from "./ExportDialog.tsx";
import { ManageDialog } from "./ManageDialog.tsx";
import { QuestionEditor } from "./QuestionEditor.tsx";
import { errorText, useBank, useLoad } from "./bank.tsx";
import { useWorkspace } from "../../workspace/ui/workspace.tsx";

const PAGE = 50;

/** Subject tree flattened for a select, with indentation. */
function nodeOptions(nodes: readonly TaxonomyNode[]) {
  const out: { id: string; label: string }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const n of nodes
      .filter((x) => x.parentId === parent)
      .sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ id: n.id, label: `${" ".repeat(depth)}${n.name}` });
      if (depth < KIND_BY_DEPTH.length - 1) walk(n.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Panel = null | "hub" | "import" | "export" | "manage" | "duplicates";
type BulkPick = "classify" | "tag" | "collection" | null;

export default function QuestionsScreen() {
  const { repo, rev, refresh } = useBank();
  useIntent((i) => {
    if (i.kind === "search") setSearchText(i.text);
    else if (i.kind === "add") setEditing("new");
    else if (i.kind === "import") choose("paste");
    else if (i.target === "hub") setPanel("hub");
    else if (i.target === "prompt") choose("prompt");
    else if (i.target === "subjects") choose("subject");
    else if (i.target === "export") setPanel("export");
  });
  const ws = useWorkspace();
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState<QuestionQuery>(DEFAULT_QUERY);
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText, 250);
  const [items, setItems] = useState<QuestionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<null | "new" | string>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [importFrom, setImportFrom] = useState<"paste" | "upload" | "prompt" | "ai">("paste");
  function choose(c: AddChoice) {
    if (c === "write") {
      setPanel(null);
      setEditing("new");
    } else if (c === "subject") setPanel("manage");
    else {
      setImportFrom(c);
      setPanel("import");
    }
  }
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPick, setBulkPick] = useState<BulkPick>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    ws.repo.bookmarks().then(
      (b) => alive && setMarks(b),
      () => undefined, // bookmarks are an extra; the list works without them
    );
    return () => {
      alive = false;
    };
  }, [ws.repo, ws.rev]);

  async function toggleBookmark(id: string) {
    const on = !marks.has(id);
    setMarks((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    try {
      await ws.repo.setBookmark(id, on);
      showToast(on ? "Bookmarked" : "Bookmark removed");
    } catch (e) {
      setError(errorText(e));
      ws.refresh();
    }
  }

  const taxonomy = useLoad((r) => r.taxonomy());
  const tags = useLoad((r) => r.tags());
  const collections = useLoad((r) => r.collections());
  const nodes = useMemo(() => taxonomy.data ?? [], [taxonomy.data]);
  const options = useMemo(() => nodeOptions(nodes), [nodes]);

  const effective: QuestionQuery = useMemo(
    () => ({ ...query, search, offset: 0, limit: PAGE }),
    [query, search],
  );

  // Load the first page whenever the filters or the bank change.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    repo.list(effective).then(
      (page) => {
        if (!alive) return;
        setItems(page.items);
        setTotal(page.total);
        setError(undefined);
        setLoading(false);
      },
      (e) => {
        if (!alive) return;
        setError(errorText(e));
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [repo, rev, effective]);

  // A change to the filters clears the selection.
  useEffect(() => setSelected(new Set()), [query, search]);

  async function loadMore() {
    setMore(true);
    try {
      const page = await repo.list({ ...effective, offset: items.length });
      setItems((cur) => [...cur, ...page.items]);
      setTotal(page.total);
    } catch (e) {
      setError(errorText(e));
    }
    setMore(false);
  }

  // Load the next page when the end of the list scrolls into view. The button stays as a fallback.
  const endRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const canLoadMore = items.length < total && !more;
  useEffect(() => {
    const el = endRef.current;
    if (!el || !canLoadMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMoreRef.current();
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canLoadMore, items.length]);

  const patch = (p: Partial<QuestionQuery>) => setQuery((q) => ({ ...q, ...p }));
  const filtered =
    search !== "" ||
    query.nodeId !== null ||
    query.unclassified ||
    query.qtypes.length > 0 ||
    query.difficulties.length > 0 ||
    query.tagId !== null ||
    query.collectionId !== null;
  const archive = query.status === "archived";
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
      label: options.find((o) => o.id === query.nodeId)?.label.trim() ?? "Subject",
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
      label: (tags.data ?? []).find((t) => t.id === query.tagId)?.name ?? "Tag",
      clear: () => patch({ tagId: null }),
    });
  }
  if (query.collectionId) {
    activeChips.push({
      id: "collection",
      label:
        (collections.data ?? []).find((c) => c.id === query.collectionId)?.name ?? "Collection",
      clear: () => patch({ collectionId: null }),
    });
  }

  function clearFilters() {
    setSearchText("");
    setQuery((q) => ({ ...DEFAULT_QUERY, status: q.status, sort: q.sort }));
  }

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function bulk(action: BulkAction, done: string) {
    setBulkBusy(true);
    setError(undefined);
    try {
      await repo.bulk([...selected], action);
      showToast(done);
      setSelected(new Set());
      setBulkPick(null);
      refresh();
    } catch (e) {
      setError(errorText(e));
    }
    setBulkBusy(false);
  }

  const empty = !loading && total === 0 && !filtered && !error;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="module-title" className="m-0 text-3xl font-bold">
            Questions
          </h1>
          <p className="m-0 text-sm text-muted" aria-live="polite">
            {loading && items.length === 0
              ? "Loading…"
              : `${total.toLocaleString()} ${archive ? "archived" : ""} question${total === 1 ? "" : "s"}${filtered ? " match" : ""}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<PlusIcon />} onClick={() => setPanel("hub")}>
            Add questions
          </Button>
          <Button variant="secondary" onClick={() => setPanel("export")}>
            Export
          </Button>
          <Button variant="secondary" onClick={() => setPanel("manage")}>
            Organize
          </Button>
          {!empty && (
            <Button variant="secondary" onClick={() => setPanel("duplicates")}>
              Duplicates
            </Button>
          )}
        </div>
      </header>

      <div role="tablist" aria-label="Question status" className="flex gap-1 border-b border-line">
        {(["active", "archived"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={query.status === s}
            onClick={() => patch({ status: s })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
              query.status === s ? "border-accent text-fg" : "border-transparent text-muted"
            }`}
          >
            {s === "active" ? "Questions" : "Archive"}
          </button>
        ))}
      </div>

      {!empty && (
        <section
          aria-label="Search and filters"
          className={`lv-card flex flex-col gap-3 p-4 ${
            filtersOpen || selected.size > 0 ? "" : "max-md:sticky max-md:top-2 max-md:z-10"
          }`}
        >
          <div className="flex gap-2">
            <input
              type="search"
              className="lv-input min-w-0 flex-1"
              aria-label="Search questions"
              placeholder="Search questions and explanations"
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
          <div
            id="question-filters"
            className={`${filtersOpen ? "grid" : "hidden"} grid-cols-2 gap-2 md:grid md:grid-cols-3 xl:grid-cols-6`}
          >
            <select
              className="lv-input"
              aria-label="Filter by type"
              value={query.qtypes[0] ?? ""}
              onChange={(e) =>
                patch({ qtypes: e.target.value ? [e.target.value as QuestionType] : [] })
              }
            >
              <option value="">All types</option>
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              className="lv-input"
              aria-label="Filter by subject"
              value={query.unclassified ? "__none" : (query.nodeId ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                patch({
                  nodeId: v && v !== "__none" ? v : null,
                  unclassified: v === "__none",
                });
              }}
            >
              <option value="">All subjects</option>
              <option value="__none">Unclassified</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="lv-input"
              aria-label="Filter by difficulty"
              value={query.difficulties[0] ?? ""}
              onChange={(e) =>
                patch({ difficulties: e.target.value ? [Number(e.target.value)] : [] })
              }
            >
              <option value="">Any difficulty</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  Level {d}
                </option>
              ))}
            </select>
            <select
              className="lv-input"
              aria-label="Filter by tag"
              value={query.tagId ?? ""}
              onChange={(e) => patch({ tagId: e.target.value || null })}
            >
              <option value="">All tags</option>
              {(tags.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              className="lv-input"
              aria-label="Filter by collection"
              value={query.collectionId ?? ""}
              onChange={(e) => patch({ collectionId: e.target.value || null })}
            >
              <option value="">All collections</option>
              {(collections.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="lv-input"
              aria-label="Sort"
              value={query.sort}
              onChange={(e) => patch({ sort: e.target.value as QuestionQuery["sort"] })}
            >
              <option value="updated">Last edited</option>
              <option value="created">Newest</option>
              <option value="stem">Alphabetical</option>
            </select>
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
      )}

      {error && (
        <p
          role="alert"
          className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="lv-card sticky top-2 z-10 flex flex-wrap items-center gap-2 p-3"
        >
          <span className="mr-2 text-sm font-semibold">{selected.size} selected</span>
          {!archive && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkPick(bulkPick === "classify" ? null : "classify")}
              >
                Classify
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkPick(bulkPick === "tag" ? null : "tag")}
              >
                Add tag
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkPick(bulkPick === "collection" ? null : "collection")}
              >
                Add to collection
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={bulkBusy}
                onClick={() =>
                  void bulk({ kind: "archive" }, `Archived ${selected.size} question(s).`)
                }
              >
                Archive
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </>
          )}
          {archive && (
            <>
              <Button
                variant="secondary"
                size="sm"
                loading={bulkBusy}
                onClick={() =>
                  void bulk({ kind: "restore" }, `Restored ${selected.size} question(s).`)
                }
              >
                Restore
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete forever
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
          {bulkPick === "classify" && (
            <select
              className="lv-input basis-full"
              aria-label="Move to subject"
              defaultValue=""
              onChange={(e) =>
                e.target.value !== "" &&
                void bulk(
                  { kind: "classify", nodeId: e.target.value === "__none" ? null : e.target.value },
                  "Classification updated.",
                )
              }
            >
              <option value="" disabled>
                Choose a subject, chapter or topic
              </option>
              <option value="__none">Remove classification</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {bulkPick === "tag" && (
            <select
              className="lv-input basis-full"
              aria-label="Tag to add"
              defaultValue=""
              onChange={(e) =>
                e.target.value &&
                void bulk({ kind: "tag", tagId: e.target.value, add: true }, "Tag added.")
              }
            >
              <option value="" disabled>
                Choose a tag
              </option>
              {(tags.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {bulkPick === "collection" && (
            <select
              className="lv-input basis-full"
              aria-label="Collection to add to"
              defaultValue=""
              onChange={(e) =>
                e.target.value &&
                void bulk(
                  { kind: "collection", collectionId: e.target.value, add: true },
                  "Added to collection.",
                )
              }
            >
              <option value="" disabled>
                Choose a collection
              </option>
              {(collections.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {bulkPick && (tags.data ?? []).length === 0 && bulkPick === "tag" && (
            <p className="m-0 basis-full text-sm text-muted">
              No tags yet. Create them under Organize.
            </p>
          )}
        </div>
      )}

      {loading && items.length === 0 && !error ? (
        <ListSkeleton />
      ) : empty ? (
        <div className="lv-card">
          <EmptyState
            title={archive ? "The archive is empty" : "Add your first questions"}
            icon={<QuestionsIcon size={36} />}
            description={
              archive
                ? "Questions you archive appear here. You can restore them at any time."
                : "Write a question yourself, or import a JSON or CSV file."
            }
            action={
              archive ? undefined : (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button icon={<PlusIcon />} onClick={() => setEditing("new")}>
                    Add question
                  </Button>
                  <Button variant="secondary" onClick={() => setPanel("import")}>
                    Import a file
                  </Button>
                </div>
              )
            }
          />
        </div>
      ) : items.length === 0 && !error ? (
        <div className="lv-card">
          <EmptyState
            title="No questions match"
            icon={<SearchIcon size={36} />}
            description="Try a different search or clear the filters."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <section aria-label="Question list" className="flex flex-col gap-2">
          <label className="flex items-center gap-2 px-1 text-sm text-muted">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
              }
              className="size-4 accent-[var(--lv-accent)]"
            />
            Select all on this page
          </label>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {items.map((q) => (
              <QuestionRow
                key={q.id}
                q={q}
                path={pathOf(q.nodeId, nodes)}
                selected={selected.has(q.id)}
                bookmarked={marks.has(q.id)}
                archive={archive}
                onToggle={toggle}
                onOpen={setEditing}
                onBookmark={(id) => void toggleBookmark(id)}
              />
            ))}
          </ul>
          {items.length < total && (
            <div ref={endRef} className="flex justify-center py-2">
              <Button variant="secondary" loading={more} onClick={() => void loadMore()}>
                Show more ({total - items.length} left)
              </Button>
            </div>
          )}
        </section>
      )}

      {editing !== null && (
        <QuestionEditor
          id={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onManage={() => setPanel("manage")}
        />
      )}
      {panel === "hub" && <AddHub onChoose={choose} onClose={() => setPanel(null)} />}
      {panel === "import" && <ImportDialog initial={importFrom} onClose={() => setPanel(null)} />}
      {panel === "export" && <ExportDialog onClose={() => setPanel(null)} />}
      {panel === "manage" && <ManageDialog onClose={() => setPanel(null)} />}
      {panel === "duplicates" && <DuplicatesDialog onClose={() => setPanel(null)} />}

      <Dialog
        open={confirmDelete}
        variant="modal"
        title="Delete forever?"
        onClose={() => {
          setConfirmDelete(false);
          setTyped("");
        }}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmDelete(false);
                setTyped("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={typed !== "DELETE"}
              loading={bulkBusy}
              onClick={async () => {
                await bulk({ kind: "delete" }, `Deleted ${selected.size} question(s).`);
                setConfirmDelete(false);
                setTyped("");
              }}
            >
              Delete {selected.size} question{selected.size === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0">
            This permanently deletes {selected.size} question{selected.size === 1 ? "" : "s"}, with
            their bookmarks, notes and revision cards. Sessions you finished keep their own copy of
            the question. It cannot be undone.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Type DELETE to confirm
            <input className="lv-input" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
