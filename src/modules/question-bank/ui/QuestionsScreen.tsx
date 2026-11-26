import { showToast } from "../../../core/toast.ts";
import { QuestionRow } from "./QuestionRow.tsx";
import { DuplicatesDialog } from "./DuplicatesDialog.tsx";
import AddHub, { type AddChoice } from "./AddHub.tsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { colorCss } from "../domain/colors.ts";
import { BulkBar } from "./parts/BulkBar.tsx";
import { FilterBar } from "./parts/FilterBar.tsx";
import { useQuestionPages } from "./parts/useQuestionPages.ts";
import { useIntent } from "../../../core/intents.ts";
import {
  Button,
  EmptyState,
  ListSkeleton,
  PlusIcon,
  QuestionsIcon,
  SearchIcon,
  QuestionsScene,
  SearchScene,
} from "../../../ui-kit/index.ts";
import { DEFAULT_QUERY, pathOf, type BulkAction, type QuestionQuery } from "../data/repo.ts";
import { SAMPLE_QUESTIONS } from "../domain/samplePack.ts";
import { ImportDialog } from "./ImportExportDialogs.tsx";
import { ExportDialog } from "./ExportDialog.tsx";
import { ManageDialog } from "./ManageDialog.tsx";
import { subjectOptions } from "./subjectOptions.ts";
import { QuestionEditor } from "./QuestionEditor.tsx";
import { errorText, useBank, useLoad } from "./bank.tsx";
import { useWorkspace } from "../../workspace/ui/workspace.tsx";
import { handoff, usePractice } from "../../practice/ui/practice.tsx";
import { startFromQuestions } from "../../practice/ui/start.ts";

const PAGE = 50;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Panel = null | "hub" | "import" | "export" | "manage" | "duplicates";

export default function QuestionsScreen({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { repo, rev, refresh } = useBank();
  const { attempts } = usePractice();
  useIntent((i) => {
    if (i.kind === "search") setSearchText(i.text);
    else if (i.kind === "add") setEditing("new");
    else if (i.kind === "import") choose("paste");
    else if (i.kind !== "open") return;
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
  const subjectColor = useCallback(
    (nodeId: string | null) => {
      let n = nodes.find((x) => x.id === nodeId);
      while (n?.parentId) n = nodes.find((x) => x.id === n!.parentId);
      return colorCss(n?.color);
    },
    [nodes],
  );
  const options = useMemo(() => subjectOptions(nodes), [nodes]);

  const effective: QuestionQuery = useMemo(
    () => ({ ...query, search, offset: 0, limit: PAGE }),
    [query, search],
  );

  const { items, total, loading, more, error, setError, loadMore, endRef } = useQuestionPages(
    repo,
    rev,
    effective,
  );

  // A change to the filters clears the selection.
  useEffect(() => setSelected(new Set()), [query, search]);

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

  /** Applies one change to some questions and offers Undo for the reversible ones. */
  async function change(ids: string[], action: BulkAction, done: string) {
    await repo.bulk(ids, action);
    // Archiving and restoring are reversible, so the toast offers to take it back.
    const back: BulkAction | null =
      action.kind === "archive"
        ? { kind: "restore" }
        : action.kind === "restore"
          ? { kind: "archive" }
          : null;
    showToast(
      done,
      back
        ? {
            label: "Undo",
            run: () => {
              repo.bulk(ids, back).then(refresh, (e) => setError(errorText(e)));
            },
          }
        : undefined,
    );
    refresh();
  }

  async function bulk(action: BulkAction, done: string) {
    setBulkBusy(true);
    setError(undefined);
    try {
      await change([...selected], action, done);
      setSelected(new Set());
    } catch (e) {
      setError(errorText(e));
    }
    setBulkBusy(false);
  }

  /** The actions in a row's menu. */
  const rowActions = {
    archive: (id: string) =>
      change(
        [id],
        { kind: archive ? "restore" : "archive" },
        archive ? "Restored." : "Archived.",
      ).catch((e) => setError(errorText(e))),
    revise: (id: string) =>
      ws.repo.addCards([id]).then(
        () => {
          ws.refresh();
          showToast("Added to revision.");
        },
        (e) => setError(errorText(e)),
      ),
    practise: (id: string) =>
      startFromQuestions(repo, attempts, [id], "Practice: one question").then(
        (attemptId) => {
          handoff.attemptId = attemptId;
          onNavigate("#/practice");
        },
        (e) => setError(errorText(e)),
      ),
  };

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
        <FilterBar
          query={query}
          patch={patch}
          searchText={searchText}
          search={search}
          setSearchText={setSearchText}
          options={options}
          tags={tags.data ?? []}
          collections={collections.data ?? []}
          filtered={filtered}
          clearFilters={clearFilters}
          selecting={selected.size > 0}
        />
      )}

      {error && (
        <p
          role="alert"
          className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <BulkBar
        count={selected.size}
        archive={archive}
        busy={bulkBusy}
        options={options}
        tags={tags.data ?? []}
        collections={collections.data ?? []}
        onBulk={bulk}
        onClear={() => setSelected(new Set())}
      />

      {loading && items.length === 0 && !error ? (
        <ListSkeleton />
      ) : empty ? (
        <div className="lv-card">
          <EmptyState
            title={archive ? "The archive is empty" : "Add your first questions"}
            icon={<QuestionsIcon size={36} />}
            art={archive ? undefined : <QuestionsScene />}
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
                  <Button
                    variant="ghost"
                    onClick={() =>
                      repo.create(SAMPLE_QUESTIONS).then(
                        () => {
                          showToast(
                            "Added 12 sample questions, tagged sample. Delete them any time.",
                          );
                          refresh();
                        },
                        (e) => setError(errorText(e)),
                      )
                    }
                  >
                    Try 12 sample questions
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
            art={<SearchScene />}
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
                color={subjectColor(q.nodeId)}

                selected={selected.has(q.id)}
                bookmarked={marks.has(q.id)}
                archive={archive}
                onToggle={toggle}
                onOpen={setEditing}
                onBookmark={(id) => void toggleBookmark(id)}
                onPractise={rowActions.practise}
                onRevise={rowActions.revise}
                onArchive={rowActions.archive}
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
    </div>
  );
}
