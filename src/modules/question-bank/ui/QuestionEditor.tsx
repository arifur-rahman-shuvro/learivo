import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Dialog, Field, Spinner } from "../../../design-system/index.ts";
import { contentHash } from "../domain/hash.ts";
import {
  QUESTION_TYPES,
  TYPE_LABELS,
  blankQuestion,
  validateQuestion,
  type AnswerSpec,
  type Issue,
  type QuestionInput,
  type QuestionType,
} from "../domain/model.ts";
import {
  KIND_BY_DEPTH,
  type QuestionRecord,
  type QuestionVersion,
  type TaxonomyNode,
} from "../data/repo.ts";
import { AnswerEditor } from "./AnswerEditor.tsx";
import { QuestionPreview } from "./QuestionPreview.tsx";
import { errorText, useBank, useLoad } from "./bank.tsx";

const DRAFT_KEY = "learivo:draft:new-question";
type Tab = "edit" | "preview" | "history";

const KIND_LABEL = ["Subject", "Chapter", "Topic", "Subtopic"];

function loadDraft(): QuestionInput | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as QuestionInput) : null;
  } catch {
    return null;
  }
}
function saveDraft(q: QuestionInput | null) {
  try {
    if (q) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(q));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage can be unavailable; drafts are a convenience only */
  }
}

/** Drop empty entries typed while editing lists, so they do not count as answers. */
function tidy(q: QuestionInput): QuestionInput {
  const a = q.answer;
  let answer: AnswerSpec = a;
  if ("accepted" in a) answer = { accepted: a.accepted.map((x) => x.trim()).filter(Boolean) };
  else if ("blanks" in a)
    answer = {
      blanks: a.blanks.map((b) => ({ accepted: b.accepted.map((x) => x.trim()).filter(Boolean) })),
    };
  return { ...q, answer };
}

function nodeChain(path: string[], nodes: readonly TaxonomyNode[]): (TaxonomyNode | undefined)[] {
  const chain: (TaxonomyNode | undefined)[] = [];
  let parent: string | null = null;
  for (const name of path) {
    const n: TaxonomyNode | undefined = nodes.find((x) => x.parentId === parent && x.name === name);
    chain.push(n);
    parent = n?.id ?? null;
    if (!n) break;
  }
  return chain;
}

interface Props {
  /** null creates a new question. */
  id: string | null;
  onClose: () => void;
  onManage: () => void;
}

export function QuestionEditor({ id, onClose, onManage }: Props) {
  const { repo, refresh } = useBank();
  const taxonomy = useLoad((r) => r.taxonomy());
  const tagsLoad = useLoad((r) => r.tags());
  const nodes = useMemo(() => taxonomy.data ?? [], [taxonomy.data]);

  const [draft, setDraft] = useState<QuestionInput | null>(null);
  const [original, setOriginal] = useState<QuestionRecord | null>(null);
  const [tab, setTab] = useState<Tab>("edit");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [duplicate, setDuplicate] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [versions, setVersions] = useState<QuestionVersion[] | null>(null);
  const [newTag, setNewTag] = useState("");

  // Open the question (or a fresh form, restoring an unsaved draft).
  useEffect(() => {
    let alive = true;
    if (id === null) {
      const saved = loadDraft();
      setDraft(saved ?? blankQuestion());
      setRestoredDraft(Boolean(saved));
      setOriginal(null);
      return;
    }
    repo.get(id).then(
      (rec) => {
        if (!alive) return;
        if (!rec) {
          setFailure("This question no longer exists.");
          return;
        }
        setDraft(rec);
        setOriginal(rec);
      },
      (e) => alive && setFailure(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [id, repo]);

  // Keep an unsaved new question as a draft.
  useEffect(() => {
    if (id === null && draft) saveDraft(draft.stem.trim() === "" ? null : draft);
  }, [id, draft]);

  // Duplicate warning under the statement.
  useEffect(() => {
    if (!draft || draft.stem.trim() === "") {
      setDuplicate(false);
      return;
    }
    const mine = contentHash(draft.stem, draft.qtype);
    if (original && contentHash(original.stem, original.qtype) === mine) {
      setDuplicate(false);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      repo.hashes().then(
        (set) => alive && setDuplicate(set.has(mine)),
        () => alive && setDuplicate(false),
      );
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [draft?.stem, draft?.qtype, original, repo]); // eslint-disable-line react-hooks/exhaustive-deps

  const chain = useMemo(() => (draft ? nodeChain(draft.path, nodes) : []), [draft, nodes]);

  if (failure && !draft) {
    return (
      <Dialog open title="Question" onClose={onClose}>
        <p role="alert" className="text-danger">
          {failure}
        </p>
      </Dialog>
    );
  }
  if (!draft) {
    return (
      <Dialog open title={id ? "Edit question" : "New question"} onClose={onClose}>
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      </Dialog>
    );
  }

  const set = (patch: Partial<QuestionInput>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const issueFor = (field: string) => issues.find((i) => i.field === field)?.message;

  function changeType(next: QuestionType) {
    if (!draft || next === draft.qtype) return;
    const fresh = blankQuestion(next);
    // Keep the choices when moving between option-based types.
    const keep = "options" in draft.answer && "options" in fresh.answer;
    let answer = keep ? draft.answer : fresh.answer;
    if (keep && next !== "multi_select" && "options" in answer) {
      let seen = false;
      answer = {
        options: answer.options.map((o) => {
          const correct = o.correct && !seen;
          seen = seen || o.correct;
          return { ...o, correct };
        }),
      };
    }
    set({ qtype: next, answer });
  }

  async function save(addAnother: boolean) {
    if (!draft) return;
    const result = validateQuestion(tidy(draft));
    if (!result.ok) {
      setIssues(result.issues);
      setTab("edit");
      return;
    }
    setIssues([]);
    setSaving(true);
    setFailure(undefined);
    try {
      if (id === null) await repo.create([result.value]);
      else await repo.update(id, result.value);
      saveDraft(null);
      refresh();
      if (addAnother && id === null) {
        setDraft(blankQuestion(draft.qtype));
        setRestoredDraft(false);
        setSaving(false);
      } else {
        onClose();
      }
    } catch (e) {
      setFailure(errorText(e));
      setSaving(false);
    }
  }

  async function openHistory() {
    setTab("history");
    if (id && versions === null) {
      try {
        setVersions(await repo.versions(id));
      } catch (e) {
        setFailure(errorText(e));
        setVersions([]);
      }
    }
  }

  const tagNames = tagsLoad.data?.map((t) => t.name) ?? [];
  const toggleTag = (name: string) =>
    set({
      tags: draft.tags.some((t) => t.toLowerCase() === name.toLowerCase())
        ? draft.tags.filter((t) => t.toLowerCase() !== name.toLowerCase())
        : [...draft.tags, name],
    });
  const addTag = () => {
    const name = newTag.trim();
    if (name && !draft.tags.some((t) => t.toLowerCase() === name.toLowerCase()))
      set({ tags: [...draft.tags, name] });
    setNewTag("");
  };

  const tabs: [Tab, string][] = [
    ["edit", "Edit"],
    ["preview", "Preview"],
    ...(id ? ([["history", "History"]] as [Tab, string][]) : []),
  ];

  return (
    <Dialog
      open
      title={id ? "Edit question" : "New question"}
      onClose={onClose}
      footer={
        <>
          {failure && (
            <p role="alert" className="mr-auto text-sm text-danger">
              {failure}
            </p>
          )}
          {id === null && (
            <Button variant="secondary" loading={saving} onClick={() => void save(true)}>
              Save and add another
            </Button>
          )}
          <Button loading={saving} onClick={() => void save(false)}>
            Save question
          </Button>
        </>
      }
    >
      <div
        role="tablist"
        aria-label="Editor sections"
        className="mb-4 flex gap-1 border-b border-line"
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => (key === "history" ? void openHistory() : setTab(key))}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === key ? "border-accent text-fg" : "border-transparent text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "preview" && <QuestionPreview question={tidy(draft)} />}

      {tab === "history" && (
        <div className="flex flex-col gap-3">
          {versions === null ? (
            <Spinner />
          ) : versions.length === 0 ? (
            <p className="m-0 text-muted">No earlier versions yet.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {versions.map((v) => (
                <li key={v.version} className="rounded-control border border-line p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      Version {v.version}{" "}
                      <span className="font-normal text-muted">
                        {new Date(v.savedAt).toLocaleString()}
                      </span>
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDraft({ ...v.question });
                        setTab("edit");
                      }}
                    >
                      Restore this version
                    </Button>
                  </div>
                  <p className="m-0 line-clamp-2 text-sm text-muted">{v.question.stem}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "edit" && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save(false);
          }}
        >
          {restoredDraft && (
            <p
              role="status"
              className="m-0 rounded-control border border-line bg-surface-2 p-2 text-sm"
            >
              Your unsaved draft was restored.{" "}
              <button
                type="button"
                className="font-semibold text-accent underline"
                onClick={() => {
                  setDraft(blankQuestion());
                  setRestoredDraft(false);
                  saveDraft(null);
                }}
              >
                Start over
              </button>
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="q-type" className="text-sm font-semibold">
              Question type
            </label>
            <select
              id="q-type"
              className="lv-input"
              value={draft.qtype}
              onChange={(e) => changeType(e.target.value as QuestionType)}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="q-stem" className="text-sm font-semibold">
              Question
            </label>
            <textarea
              id="q-stem"
              className="lv-input min-h-28"
              value={draft.stem}
              aria-invalid={issueFor("stem") ? true : undefined}
              onChange={(e) => set({ stem: e.target.value })}
            />
            {issueFor("stem") && (
              <p role="alert" className="m-0 text-sm font-medium text-danger">
                {issueFor("stem")}
              </p>
            )}
            {duplicate && (
              <p role="status" className="m-0 text-sm font-medium text-warning">
                A question with the same text and type is already in your bank.
              </p>
            )}
          </div>

          <AnswerEditor
            qtype={draft.qtype}
            answer={draft.answer}
            onChange={(answer) => set({ answer })}
          />
          {issueFor("answer") && (
            <p role="alert" className="m-0 text-sm font-medium text-danger">
              {issueFor("answer")}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="q-expl" className="text-sm font-semibold">
              Explanation <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="q-expl"
              className="lv-input min-h-20"
              value={draft.explanation}
              onChange={(e) => set({ explanation: e.target.value })}
            />
          </div>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 flex w-full items-center justify-between text-sm font-semibold">
              Classification
              <button
                type="button"
                className="text-sm font-semibold text-accent underline"
                onClick={onManage}
              >
                Manage subjects
              </button>
            </legend>
            {KIND_BY_DEPTH.map((_, depth) => {
              const parentId = depth === 0 ? null : (chain[depth - 1]?.id ?? undefined);
              if (parentId === undefined) return null;
              const options = nodes.filter((n) => n.parentId === parentId);
              if (options.length === 0 && !chain[depth]) return null;
              return (
                <select
                  key={depth}
                  className="lv-input"
                  aria-label={KIND_LABEL[depth]}
                  value={chain[depth]?.id ?? ""}
                  onChange={(e) => {
                    const node = nodes.find((n) => n.id === e.target.value);
                    const names = draft.path.slice(0, depth);
                    set({ path: node ? [...names, node.name] : names });
                  }}
                >
                  <option value="">{KIND_LABEL[depth]}: none</option>
                  {options.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              );
            })}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="q-diff" className="text-sm font-semibold">
              Difficulty
            </label>
            <select
              id="q-diff"
              className="lv-input"
              value={draft.difficulty ?? ""}
              onChange={(e) => set({ difficulty: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Not set</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  Level {d}
                  {d === 1 ? " (easiest)" : d === 5 ? " (hardest)" : ""}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-semibold">Tags</legend>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...tagNames, ...draft.tags])].map((name) => {
                const on = draft.tags.some((t) => t.toLowerCase() === name.toLowerCase());
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTag(name)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      on
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line-strong text-muted"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                className="lv-input"
                aria-label="New tag"
                placeholder="New tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button variant="secondary" onClick={addTag}>
                Add tag
              </Button>
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Source"
              value={draft.source}
              onChange={(e) => set({ source: e.target.value })}
            />
            <Field
              label="Institution"
              value={draft.institution}
              onChange={(e) => set({ institution: e.target.value })}
            />
            <Field
              label="Exam name"
              value={draft.examName}
              onChange={(e) => set({ examName: e.target.value })}
            />
            <Field
              label="Exam year"
              inputMode="numeric"
              value={draft.examYear ?? ""}
              error={issueFor("examYear")}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                set({ examYear: Number.isNaN(n) ? null : n });
              }}
            />
          </div>
          <button type="submit" hidden />
          {issues.filter((i) => !["stem", "answer", "examYear"].includes(i.field)).length > 0 && (
            <ul role="alert" className="m-0 pl-5 text-sm text-danger">
              {issues
                .filter((i) => !["stem", "answer", "examYear"].includes(i.field))
                .map((i, k) => (
                  <li key={k}>{i.message}</li>
                ))}
            </ul>
          )}
          {id !== null && original && (
            <p className="m-0 text-xs text-muted">
              <Badge>Version {original.version}</Badge>
            </p>
          )}
        </form>
      )}
    </Dialog>
  );
}
