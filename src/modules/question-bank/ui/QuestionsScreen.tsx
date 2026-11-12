import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  PlusIcon,
  Spinner,
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
import { ExportDialog, ImportDialog } from "./ImportExportDialogs.tsx";
import { ManageDialog } from "./ManageDialog.tsx";
import { QuestionEditor } from "./QuestionEditor.tsx";
import { errorText, useBank, useLoad } from "./bank.tsx";

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

type Panel = null | "import" | "export" | "manage";
type BulkPick = "classify" | "tag" | "collection" | null;

export default function QuestionsScreen() {
  const { repo, rev, refresh } = useBank();
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPick, setBulkPick] = useState<BulkPick>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

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
      setNotice(done);
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
          <Button icon={<PlusIcon />} onClick={() => setEditing("new")}>
            Add question
          </Button>
          <Button variant="secondary" onClick={() => setPanel("import")}>
            Import
          </Button>
          <Button variant="secondary" onClick={() => setPanel("export")}>
            Export
          </Button>
          <Button variant="secondary" onClick={() => setPanel("manage")}>
            Organize
          </Button>
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
        <section aria-label="Search and filters" className="lv-card flex flex-col gap-3 p-4">
          <input
            type="search"
            className="lv-input"
            aria-label="Search questions"
            placeholder="Search questions and explanations"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
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
          {filtered && (
            <div>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </section>
      )}

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
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : empty ? (
        <div className="lv-card">
          <EmptyState
            title={archive ? "The archive is empty" : "Add your first questions"}
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
            {items.map((q) => {
              const path = pathOf(q.nodeId, nodes);
              return (
                <li key={q.id} className="lv-card flex items-start gap-3 p-3.5">
                  <input
                    type="checkbox"
                    aria-label={`Select: ${q.stem.slice(0, 60)}`}
                    checked={selected.has(q.id)}
                    onChange={() => toggle(q.id)}
                    className="mt-1 size-4 shrink-0 accent-[var(--lv-accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setEditing(q.id)}
                    className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
                  >
                    <span className="line-clamp-2 font-semibold">{q.stem}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <Badge>{TYPE_LABELS[q.qtype]}</Badge>
                      {path.length > 0 && <span>{path.join(" › ")}</span>}
                      {q.difficulty !== null && <span>Level {q.difficulty}</span>}
                      {q.tags.slice(0, 3).map((t) => (
                        <Badge key={t} tone="accent">
                          {t}
                        </Badge>
                      ))}
                      {q.tags.length > 3 && <span>+{q.tags.length - 3}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {items.length < total && (
            <div className="flex justify-center py-2">
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
      {panel === "import" && <ImportDialog onClose={() => setPanel(null)} />}
      {panel === "export" && <ExportDialog onClose={() => setPanel(null)} />}
      {panel === "manage" && <ManageDialog onClose={() => setPanel(null)} />}

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
            This permanently deletes {selected.size} question{selected.size === 1 ? "" : "s"} and
            their history. It cannot be undone.
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
