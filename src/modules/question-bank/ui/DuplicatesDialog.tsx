import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Dialog } from "../../../design-system/index.ts";
import { DEFAULT_QUERY, type QuestionRecord } from "../data/repo.ts";
import { findDuplicates, pairKey, pairToGroup, type DuplicateGroup } from "../domain/duplicates.ts";
import { contentHash } from "../domain/hash.ts";
import { findSimilarPairs, toComparable, type SimilarPair } from "../domain/similarity.ts";
import { errorText, useBank } from "./bank.tsx";

const DISMISSED_KEY = "learivo.notDuplicates";

function loadDismissed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function saveDismissed(set: ReadonlySet<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set].slice(-2000)));
  } catch {
    /* private mode: the choice lasts until the dialog closes */
  }
}

interface Pair extends SimilarPair {
  qa: QuestionRecord;
  qb: QuestionRecord;
}

/**
 * Finds questions saved twice, and questions that say nearly the same thing in different words.
 * Extra copies are archived, never deleted, and their tags and collections move to the one that stays.
 */
export function DuplicatesDialog({ onClose }: { onClose: () => void }) {
  const { repo, refresh } = useBank();
  const [groups, setGroups] = useState<DuplicateGroup<QuestionRecord>[] | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const scan = useCallback(async () => {
    const all: QuestionRecord[] = [];
    for (let offset = 0; ; offset += 200) {
      const page = await repo.list({ ...DEFAULT_QUERY, offset, limit: 200 });
      all.push(...page.items);
      if (page.items.length < 200) break;
    }
    setGroups(findDuplicates(all));
    const byId = new Map(all.map((q) => [q.id, q]));
    setPairs(
      findSimilarPairs(all.map(toComparable))
        // Identical wording is already in the exact list above.
        .filter(
          (p) =>
            contentHash(byId.get(p.a.id)!.stem, p.a.qtype) !==
            contentHash(byId.get(p.b.id)!.stem, p.b.qtype),
        )
        .map((p) => ({ ...p, qa: byId.get(p.a.id)!, qb: byId.get(p.b.id)! })),
    );
  }, [repo]);

  useEffect(() => {
    scan().catch((e) => setError(errorText(e)));
  }, [scan]);

  const open = useMemo(
    () => pairs.filter((p) => !dismissed.has(pairKey(p.a.id, p.b.id))),
    [pairs, dismissed],
  );

  async function merge(list: DuplicateGroup<QuestionRecord>[]) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let archived = 0;
      for (const g of list) {
        for (const tagId of g.moveTags)
          await repo.bulk([g.keep.id], { kind: "tag", tagId, add: true });
        for (const collectionId of g.moveCollections) {
          await repo.bulk([g.keep.id], { kind: "collection", collectionId, add: true });
        }
        const ids = g.extras.map((e) => e.id);
        await repo.bulk(ids, { kind: "archive" });
        archived += ids.length;
      }
      refresh();
      setMessage(`Archived ${archived} extra cop${archived === 1 ? "y" : "ies"}.`);
      await scan();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function dismiss(p: Pair) {
    const next = new Set(dismissed).add(pairKey(p.a.id, p.b.id));
    setDismissed(next);
    saveDismissed(next);
  }

  const extras = groups?.reduce((n, g) => n + g.extras.length, 0) ?? 0;
  const nothing = groups !== null && groups.length === 0 && open.length === 0;
  return (
    <Dialog
      open
      variant="modal"
      title="Find duplicates"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {groups && groups.length > 0 && (
            <Button loading={busy} onClick={() => void merge(groups)}>
              Archive all {extras} extra cop{extras === 1 ? "y" : "ies"}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {groups === null && !error && <p className="m-0 text-sm text-muted">Checking your bank…</p>}
        {nothing && (
          <p className="m-0 text-sm">No duplicates found. Every question is different.</p>
        )}

        {groups && groups.length > 0 && (
          <section aria-label="Exact copies" className="flex flex-col gap-2">
            <h3 className="m-0 text-base font-semibold">Exact copies</h3>
            <p className="m-0 text-sm text-muted">
              These questions are saved more than once. The oldest copy stays. The others are
              archived, so you can restore them later, and their tags and collections move to the
              copy that stays.
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {groups.map((g) => (
                <li key={g.keep.id} className="rounded-control border border-line p-3">
                  <div className="line-clamp-2 text-sm font-semibold">{g.keep.stem}</div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-sm text-muted">
                    <span>
                      {g.extras.length} extra cop{g.extras.length === 1 ? "y" : "ies"}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void merge([g])}
                    >
                      Keep one
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {open.length > 0 && (
          <section aria-label="Possible duplicates" className="flex flex-col gap-2">
            <h3 className="m-0 text-base font-semibold">Possible duplicates ({open.length})</h3>
            <p className="m-0 text-sm text-muted">
              Worded differently but probably the same question. Questions that differ by a “not” or
              a number are never listed. Nothing changes until you choose.
            </p>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {open.slice(0, 50).map((p) => (
                <li
                  key={pairKey(p.a.id, p.b.id)}
                  className="rounded-control border border-line p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone="warning">{Math.round(p.match.score * 100)}% alike</Badge>
                    <span>{p.match.why}</span>
                  </div>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                    <li>
                      <span className="font-semibold">Older: </span>
                      {pairToGroup(p.qa, p.qb).keep.stem}
                    </li>
                    <li>
                      <span className="font-semibold">Newer: </span>
                      {pairToGroup(p.qa, p.qb).extras[0]!.stem}
                    </li>
                  </ul>
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => dismiss(p)}>
                      Not a duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void merge([pairToGroup(p.qa, p.qb)])}
                    >
                      Keep the older one
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {open.length > 50 && (
              <p className="m-0 text-sm text-muted">
                Showing the 50 closest matches. Handle these and scan again for the rest.
              </p>
            )}
          </section>
        )}

        {message && (
          <p role="status" className="m-0 text-sm">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="m-0 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
