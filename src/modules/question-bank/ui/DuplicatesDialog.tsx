import { useCallback, useEffect, useState } from "react";
import { Button, Dialog } from "../../../design-system/index.ts";
import { DEFAULT_QUERY, type QuestionRecord } from "../data/repo.ts";
import { findDuplicates, type DuplicateGroup } from "../domain/duplicates.ts";
import { errorText, useBank } from "./bank.tsx";

/** Finds questions saved twice and archives the extra copies, keeping tags and collections. */
export function DuplicatesDialog({ onClose }: { onClose: () => void }) {
  const { repo, refresh } = useBank();
  const [groups, setGroups] = useState<DuplicateGroup<QuestionRecord>[] | null>(null);
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
  }, [repo]);

  useEffect(() => {
    scan().catch((e) => setError(errorText(e)));
  }, [scan]);

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

  const extras = groups?.reduce((n, g) => n + g.extras.length, 0) ?? 0;
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
      <div className="flex flex-col gap-3">
        {groups === null && !error && <p className="m-0 text-sm text-muted">Checking your bank…</p>}
        {groups && groups.length === 0 && (
          <p className="m-0 text-sm">No duplicates found. Every question is different.</p>
        )}
        {groups && groups.length > 0 && (
          <>
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
          </>
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
