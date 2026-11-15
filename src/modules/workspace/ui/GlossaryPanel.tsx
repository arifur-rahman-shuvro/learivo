import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, EmptyState, Spinner } from "../../../design-system/index.ts";
import { errorText } from "../../question-bank/ui/bank.tsx";
import { searchTerms, type GlossaryTerm } from "../domain/cards.ts";
import { useWorkspace } from "./workspace.tsx";

/** The student's own terms and what they mean, with search. */
export default function GlossaryPanel() {
  const { repo, rev } = useWorkspace();
  const [terms, setTerms] = useState<GlossaryTerm[] | null>(null);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<GlossaryTerm | "new" | null>(null);

  useEffect(() => {
    let alive = true;
    repo.glossary().then(
      (list) => alive && (setTerms(list), setError(undefined)),
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [repo, rev]);

  const shown = useMemo(() => searchTerms(terms ?? [], query), [terms, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="glossary-search" className="sr-only">
            Search glossary
          </label>
          <input
            id="glossary-search"
            type="search"
            className="lv-input"
            placeholder="Search glossary"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => setEditing("new")}>New term</Button>
      </div>
      {error && (
        <p
          role="alert"
          className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {terms === null && !error && (
        <div className="grid place-items-center py-12">
          <Spinner />
        </div>
      )}
      {terms !== null && terms.length === 0 && (
        <div className="lv-card">
          <EmptyState
            title="Your glossary is empty"
            description="Add terms and what they mean. They get underlined in explanations and notes so you can recall them quickly."
            action={<Button onClick={() => setEditing("new")}>Add your first term</Button>}
          />
        </div>
      )}
      {terms !== null && terms.length > 0 && shown.length === 0 && (
        <p className="m-0 text-sm text-muted">No terms match "{query.trim()}".</p>
      )}
      {shown.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Glossary terms">
          {shown.map((t) => (
            <li key={t.id} className="lv-card flex items-start justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="m-0 break-words font-semibold">{t.term}</p>
                <p className="m-0 mt-0.5 whitespace-pre-wrap break-words text-sm text-muted">
                  {t.definition}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <TermDialog term={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function TermDialog({ term, onClose }: { term: GlossaryTerm | null; onClose: () => void }) {
  const { repo, refresh } = useWorkspace();
  const [name, setName] = useState(term?.term ?? "");
  const [definition, setDefinition] = useState(term?.definition ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await repo.saveTerm({ id: term?.id ?? null, term: name, definition });
      refresh();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function remove() {
    if (!term) return;
    setBusy(true);
    try {
      await repo.deleteTerm(term.id);
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
      title={term ? "Edit term" : "New term"}
      onClose={onClose}
      footer={
        <>
          {term && (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete term
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save term
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
          Term
          <input
            className="lv-input"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Meaning
          <textarea
            className="lv-input"
            style={{ minHeight: "8rem" }}
            value={definition}
            maxLength={2000}
            onChange={(e) => setDefinition(e.target.value)}
          />
        </label>
      </div>
    </Dialog>
  );
}
