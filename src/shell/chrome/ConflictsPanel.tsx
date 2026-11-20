import { useState } from "react";
import { Button } from "../../ui-kit/index.ts";
import { FIELDS, describe, type Conflict, type Side } from "../../platform/offline/merge.ts";
import type { PackStatus } from "../../platform/offline/pack.ts";
import type { QuestionInput } from "../../modules/question-bank/domain/model.ts";

type Choices = Partial<Record<keyof QuestionInput, Side>>;
const label = (k: keyof QuestionInput) => FIELDS.find((f) => f.key === k)?.label ?? String(k);
const short = (s: string) => (s.length > 90 ? `${s.slice(0, 90)}…` : s);

const OUTCOME: Record<string, string> = {
  mine: "Kept my version",
  theirs: "Kept the account's version",
  merged: "Combined both",
  "re-added": "Added back as a new question",
  discarded: "Discarded my edit",
};

/** Offline edits that clash with a change made elsewhere, and the decisions made so far. */
export default function ConflictsPanel({
  status,
  busy,
  onResolve,
  onReapply,
}: {
  status: PackStatus;
  busy: boolean;
  onResolve: (id: string, choice: Side | Choices) => void;
  onReapply: (index: number, side: Side) => void;
}) {
  const [choices, setChoices] = useState<Record<string, Choices>>({});
  const pick = (id: string, k: keyof QuestionInput, side: Side) =>
    setChoices((c) => ({ ...c, [id]: { ...c[id], [k]: side } }));

  return (
    <section aria-label="Edits that need a decision" className="flex flex-col gap-3">
      {status.conflicts.length > 0 && (
        <>
          <h3 className="m-0 text-base font-semibold">Needs your decision</h3>
          <p className="m-0 text-sm text-muted">
            These edits were made offline, and the same questions were changed somewhere else. Parts
            that do not overlap are combined for you. Nothing is overwritten until you choose.
          </p>
        </>
      )}
      {status.conflicts.map((c: Conflict) => {
        const mine = choices[c.id] ?? {};
        const ready = c.clashes.every((k) => mine[k]);
        return (
          <div key={c.id} className="flex flex-col gap-3 rounded-control border border-line p-3">
            <p className="m-0 font-semibold">{short(c.mine.stem)}</p>
            {c.kind === "deleted" ? (
              <>
                <p className="m-0 text-sm">
                  This question was deleted somewhere else after you started editing it.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy} onClick={() => onResolve(c.id, "mine")}>
                    Add my version back
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onResolve(c.id, "theirs")}
                  >
                    Discard my edit
                  </Button>
                </div>
              </>
            ) : (
              <>
                {c.clashes.map((k) => (
                  <fieldset key={k} className="m-0 flex flex-col gap-1 border-0 p-0">
                    <legend className="p-0 text-sm font-semibold">{label(k)}</legend>
                    {(["mine", "theirs"] as Side[]).map((side) => (
                      <label
                        key={side}
                        className="flex cursor-pointer items-start gap-2 rounded-control border border-line p-2 text-sm"
                      >
                        <input
                          type="radio"
                          name={`${c.id}-${k}`}
                          checked={mine[k] === side}
                          onChange={() => pick(c.id, k, side)}
                          className="mt-1"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {side === "mine" ? "My edit" : "In your account"}
                          </span>
                          <span className="block whitespace-pre-wrap break-words">
                            {describe(k, (side === "mine" ? c.mine : c.theirs!)[k])}
                          </span>
                          {c.base && side === "mine" && (
                            <span className="block text-muted">
                              Before: {short(describe(k, c.base[k]).replace(/\n/g, "; "))}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy || !ready} onClick={() => onResolve(c.id, mine)}>
                    Apply my choices
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onResolve(c.id, "mine")}
                  >
                    Keep all of mine
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onResolve(c.id, "theirs")}
                  >
                    Keep the account&apos;s version
                  </Button>
                </div>
              </>
            )}
          </div>
        );
      })}
      {status.resolved.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">
            Earlier decisions ({status.resolved.length})
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {status.resolved.map((r, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-control border border-line p-2">
                <span className="font-medium">{short(r.conflict.mine.stem)}</span>
                <span className="text-muted">
                  {OUTCOME[r.outcome]}, {new Date(r.at).toLocaleString()}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onReapply(i, "mine")}
                  >
                    Bring back my version
                  </Button>
                  {r.conflict.theirs && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onReapply(i, "theirs")}
                    >
                      Bring back the account&apos;s version
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
