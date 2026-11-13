import { useEffect, useMemo, useState } from "react";
import { Button, Dialog } from "../../../design-system/index.ts";
import { KIND_BY_DEPTH, type TaxonomyNode } from "../../question-bank/data/repo.ts";
import { errorText, useBank } from "../../question-bank/ui/bank.tsx";
import type { Exam, ExamInput } from "../data/repo.ts";
import { checkRules, type ExamRule } from "../domain/session.ts";
import { fetchPool, makeInside, usePractice } from "./practice.tsx";
import type { QuestionRecord } from "../../question-bank/data/repo.ts";

function options(nodes: readonly TaxonomyNode[]) {
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

const BLANK: ExamInput = {
  title: "",
  instructions: "",
  timeLimitSec: 60 * 60,
  marksCorrect: 1,
  marksWrong: 0,
  randomize: true,
  rules: [{ nodeId: null, count: 20 }],
};

export default function ExamBuilder({ exam, onClose }: { exam: Exam | null; onClose: () => void }) {
  const { repo } = useBank();
  const { attempts, refresh } = usePractice();
  const [draft, setDraft] = useState<ExamInput>(exam ? { ...exam } : BLANK);
  const [nodes, setNodes] = useState<TaxonomyNode[]>([]);
  const [pool, setPool] = useState<QuestionRecord[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      repo.taxonomy(),
      fetchPool(repo, { nodeId: null, tagId: null, collectionId: null }),
    ]).then(
      ([n, p]) => {
        if (!alive) return;
        setNodes(n);
        setPool(p);
      },
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [repo]);

  const opts = useMemo(() => options(nodes), [nodes]);
  const checks = useMemo(
    () => checkRules(draft.rules, pool, makeInside(nodes)),
    [draft.rules, pool, nodes],
  );
  const total = draft.rules.reduce((n, r) => n + r.count, 0);
  const drawable = checks.reduce((n, c) => n + Math.min(c.rule.count, c.available), 0);

  const patch = (p: Partial<ExamInput>) => setDraft((d) => ({ ...d, ...p }));
  const setRule = (i: number, p: Partial<ExamRule>) =>
    patch({ rules: draft.rules.map((r, k) => (k === i ? { ...r, ...p } : r)) });

  async function save() {
    if (draft.title.trim() === "") return setError("Give the exam a title.");
    if (draft.rules.length === 0 || draft.rules.some((r) => r.count < 1))
      return setError("Add at least one rule that takes 1 or more questions.");
    if (total > 500) return setError("An exam can have at most 500 questions.");
    setBusy(true);
    setError(undefined);
    try {
      await attempts.saveExam(exam?.id ?? null, draft);
      refresh();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function remove() {
    if (!exam) return;
    setBusy(true);
    try {
      await attempts.deleteExam(exam.id);
      refresh();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Dialog
      open
      variant="drawer"
      title={exam ? "Edit exam" : "New exam"}
      onClose={onClose}
      footer={
        <>
          {exam && (
            <Button variant="danger" className="mr-auto" onClick={() => setConfirmDelete(true)}>
              Delete exam
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save exam
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p
            role="alert"
            className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Title
          <input
            className="lv-input"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Instructions (optional)
          <textarea
            className="lv-input min-h-20"
            value={draft.instructions}
            onChange={(e) => patch({ instructions: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Time limit (minutes)
            <input
              className="lv-input"
              type="number"
              min={1}
              max={600}
              placeholder="No limit"
              value={draft.timeLimitSec === null ? "" : Math.round(draft.timeLimitSec / 60)}
              onChange={(e) =>
                patch({
                  timeLimitSec:
                    e.target.value === "" ? null : Math.max(1, Number(e.target.value)) * 60,
                })
              }
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.randomize}
              onChange={(e) => patch({ randomize: e.target.checked })}
              className="size-4 accent-[var(--lv-accent)]"
            />
            Shuffle questions and options
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Marks per correct answer
            <input
              className="lv-input"
              type="number"
              min={0.25}
              step={0.25}
              value={draft.marksCorrect}
              onChange={(e) => patch({ marksCorrect: Math.max(0.25, Number(e.target.value) || 1) })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Marks lost per wrong answer
            <input
              className="lv-input"
              type="number"
              min={0}
              step={0.25}
              value={draft.marksWrong}
              onChange={(e) => patch({ marksWrong: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </div>

        <section aria-label="Question rules" className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-semibold">Questions</h3>
          <p className="m-0 text-sm text-muted">
            Each rule takes random questions from a subject. Rules run in order and never repeat a
            question.
          </p>
          {draft.rules.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                className="lv-input min-w-0 flex-1"
                aria-label={`Subject for rule ${i + 1}`}
                value={r.nodeId ?? ""}
                onChange={(e) => setRule(i, { nodeId: e.target.value || null })}
              >
                <option value="">Any subject</option>
                {opts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                className="lv-input w-24"
                type="number"
                min={1}
                max={500}
                aria-label={`Number of questions for rule ${i + 1}`}
                value={r.count}
                onChange={(e) =>
                  setRule(i, { count: Math.max(0, Math.floor(Number(e.target.value))) })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove rule ${i + 1}`}
                onClick={() => patch({ rules: draft.rules.filter((_, k) => k !== i) })}
              >
                Remove
              </Button>
              {checks[i]?.short && (
                <p role="status" className="m-0 basis-full text-sm text-warning">
                  Only {checks[i]!.available} question{checks[i]!.available === 1 ? "" : "s"}{" "}
                  available.
                </p>
              )}
            </div>
          ))}
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => patch({ rules: [...draft.rules, { nodeId: null, count: 10 }] })}
            >
              Add rule
            </Button>
          </div>
          <p className="m-0 text-sm font-semibold" aria-live="polite">
            {total} question{total === 1 ? "" : "s"} requested
            {drawable < total ? `, ${drawable} can be drawn from your bank now` : ""}
          </p>
        </section>
      </div>

      <Dialog
        open={confirmDelete}
        variant="modal"
        title="Delete this exam?"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void remove()}>
              Delete exam
            </Button>
          </>
        }
      >
        <p className="m-0">Past results for this exam are kept.</p>
      </Dialog>
    </Dialog>
  );
}
