import { useState } from "react";
import { Button, Dialog, Spinner } from "../../../design-system/index.ts";
import { KIND_BY_DEPTH, type TaxonomyNode } from "../data/repo.ts";
import { errorText, useBank, useLoad } from "./bank.tsx";

type Tab = "subjects" | "tags" | "collections";
const KIND_LABEL: Record<string, string> = {
  subject: "Subject",
  chapter: "Chapter",
  topic: "Topic",
  subtopic: "Subtopic",
};

/** Small inline form: type a name, press Add. */
function AddRow({ label, onAdd }: { label: string; onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        await onAdd(name.trim());
        setName("");
        setBusy(false);
      }}
    >
      <input
        className="lv-input"
        aria-label={label}
        placeholder={label}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" variant="secondary" loading={busy} disabled={!name.trim()}>
        Add
      </Button>
    </form>
  );
}

/** One named thing with rename and a two-step delete. */
function NameRow({
  name,
  hint,
  depth = 0,
  deleteNote,
  onRename,
  onDelete,
  children,
}: {
  name: string;
  hint?: string;
  depth?: number;
  deleteNote: string;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  return (
    <li style={{ marginLeft: depth * 16 }} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 rounded-control border border-line px-3 py-2">
        {editing ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!value.trim()) return;
              await run(() => onRename(value.trim()));
              setEditing(false);
            }}
          >
            <input
              className="lv-input"
              aria-label={`New name for ${name}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <Button type="submit" size="sm" loading={busy}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <span className="flex-1 font-medium">{name}</span>
            {hint && <span className="text-xs text-muted">{hint}</span>}
            {confirming ? (
              <>
                <span className="text-sm text-danger">{deleteNote}</span>
                <Button
                  variant="danger"
                  size="sm"
                  loading={busy}
                  onClick={() => void run(onDelete)}
                >
                  Confirm delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {children}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Rename ${name}`}
                  onClick={() => {
                    setValue(name);
                    setEditing(true);
                  }}
                >
                  Rename
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${name}`}
                  onClick={() => setConfirming(true)}
                >
                  Delete
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function SubjectsTab() {
  const { repo, refresh } = useBank();
  const { data, loading } = useLoad((r) => r.taxonomy());
  const [error, setError] = useState<string>();
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const nodes = data ?? [];

  const attempt = async (fn: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const depthOf = (n: TaxonomyNode) => KIND_BY_DEPTH.indexOf(n.kind);
  const ordered: TaxonomyNode[] = [];
  const walk = (parent: string | null) => {
    for (const n of nodes
      .filter((x) => x.parentId === parent)
      .sort((a, b) => a.name.localeCompare(b.name))) {
      ordered.push(n);
      walk(n.id);
    }
  };
  walk(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-muted">
        Organize questions as subject, chapter, topic and subtopic. Deleting an item removes the
        items below it. Your questions are kept and become unclassified.
      </p>
      <AddRow label="New subject" onAdd={(name) => attempt(() => repo.addNode(null, name))} />
      {error && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
      {loading && !data ? (
        <Spinner />
      ) : ordered.length === 0 ? (
        <p className="m-0 text-muted">No subjects yet. Add your first one above.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {ordered.map((n) => (
            <div key={n.id} className="contents">
              <NameRow
                name={n.name}
                depth={depthOf(n)}
                hint={KIND_LABEL[n.kind]}
                deleteNote="Deletes everything below."
                onRename={(name) => attempt(() => repo.renameNode(n.id, name))}
                onDelete={() => attempt(() => repo.deleteNode(n.id))}
              >
                {depthOf(n) < 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Add under ${n.name}`}
                    onClick={() => setAddingUnder(addingUnder === n.id ? null : n.id)}
                  >
                    Add {KIND_LABEL[KIND_BY_DEPTH[depthOf(n) + 1]!]!.toLowerCase()}
                  </Button>
                )}
              </NameRow>
              {addingUnder === n.id && (
                <li style={{ marginLeft: (depthOf(n) + 1) * 16 }} className="list-none">
                  <AddRow
                    label={`New ${KIND_LABEL[KIND_BY_DEPTH[depthOf(n) + 1]!]!.toLowerCase()} under ${n.name}`}
                    onAdd={async (name) => {
                      await attempt(() => repo.addNode(n.id, name));
                      setAddingUnder(null);
                    }}
                  />
                </li>
              )}
            </div>
          ))}
        </ul>
      )}
    </div>
  );
}

function NamedListTab({ kind }: { kind: "tags" | "collections" }) {
  const { repo, refresh } = useBank();
  const { data, loading } = useLoad((r) => (kind === "tags" ? r.tags() : r.collections()), [kind]);
  const [error, setError] = useState<string>();
  const singular = kind === "tags" ? "tag" : "collection";

  const attempt = async (fn: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-muted">
        {kind === "tags"
          ? "Tags label questions across subjects. Deleting a tag keeps the questions."
          : "Collections group questions for practice and exams. Deleting a collection keeps the questions."}
      </p>
      <AddRow
        label={`New ${singular}`}
        onAdd={(name) =>
          attempt(() => (kind === "tags" ? repo.addTag(name) : repo.addCollection(name)))
        }
      />
      {error && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
      {loading && !data ? (
        <Spinner />
      ) : (data ?? []).length === 0 ? (
        <p className="m-0 text-muted">No {kind} yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {(data ?? []).map((item) => (
            <NameRow
              key={item.id}
              name={item.name}
              hint={`${item.count} question${item.count === 1 ? "" : "s"}`}
              deleteNote={`Questions are kept.`}
              onRename={(name) =>
                attempt(() =>
                  kind === "tags"
                    ? repo.renameTag(item.id, name)
                    : repo.renameCollection(item.id, name),
                )
              }
              onDelete={() =>
                attempt(() =>
                  kind === "tags" ? repo.deleteTag(item.id) : repo.deleteCollection(item.id),
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function ManageDialog({
  onClose,
  initial = "subjects",
}: {
  onClose: () => void;
  initial?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initial);
  const tabs: [Tab, string][] = [
    ["subjects", "Subjects"],
    ["tags", "Tags"],
    ["collections", "Collections"],
  ];
  return (
    <Dialog open title="Organize your bank" onClose={onClose}>
      <div role="tablist" aria-label="Organize" className="mb-4 flex gap-1 border-b border-line">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === key ? "border-accent text-fg" : "border-transparent text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "subjects" ? <SubjectsTab /> : <NamedListTab kind={tab} />}
    </Dialog>
  );
}
