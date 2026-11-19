import { useState } from "react";
import { Button, Dialog, Picker } from "../../../../ui-kit/index.ts";
import type { PickerOption } from "../../../../ui-kit/overlays/Picker.tsx";
import type { BulkAction } from "../../data/repo.ts";

type Pick = "classify" | "tag" | "collection" | null;
interface Named {
  id: string;
  name: string;
}

interface Props {
  /** How many questions are ticked. The bar shows when this is above zero. */
  count: number;
  archive: boolean;
  busy: boolean;
  options: readonly PickerOption[];
  tags: readonly Named[];
  collections: readonly Named[];
  onBulk: (action: BulkAction, done: string) => Promise<void>;
  onClear: () => void;
}

/** The bar for doing one thing to every ticked question, plus the "type DELETE" confirmation. */
export function BulkBar({
  count,
  archive,
  busy,
  options,
  tags,
  collections,
  onBulk,
  onClear,
}: Props) {
  const [bulkPick, setBulkPick] = useState<Pick>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  async function run(action: BulkAction, done: string) {
    await onBulk(action, done);
    setBulkPick(null);
  }
  if (count === 0) return null;
  return (
    <>
      <div
        role="region"
        aria-label="Bulk actions"
        className="lv-card sticky top-2 z-10 flex flex-wrap items-center gap-2 p-3"
      >
        <span className="mr-2 text-sm font-semibold">{count} selected</span>
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
              loading={busy}
              onClick={() => void run({ kind: "archive" }, `Archived ${count} question(s).`)}
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
              loading={busy}
              onClick={() => void run({ kind: "restore" }, `Restored ${count} question(s).`)}
            >
              Restore
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete forever
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => onClear()}>
          Clear selection
        </Button>
        {bulkPick === "classify" && (
          <Picker
            className="basis-full"
            label="Move to subject"
            placeholder="Choose a subject, chapter or topic"
            value=""
            options={[{ value: "__none", label: "Remove classification" }, ...options]}
            onChange={(v) =>
              void run(
                { kind: "classify", nodeId: v === "__none" ? null : v },
                "Classification updated.",
              )
            }
          />
        )}
        {bulkPick === "tag" && (
          <Picker
            className="basis-full"
            label="Tag to add"
            placeholder="Choose a tag"
            value=""
            options={tags.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(v) => void run({ kind: "tag", tagId: v, add: true }, "Tag added.")}
          />
        )}
        {bulkPick === "collection" && (
          <Picker
            className="basis-full"
            label="Collection to add to"
            placeholder="Choose a collection"
            value=""
            options={collections.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) =>
              void run({ kind: "collection", collectionId: v, add: true }, "Added to collection.")
            }
          />
        )}
        {bulkPick && tags.length === 0 && bulkPick === "tag" && (
          <p className="m-0 basis-full text-sm text-muted">
            No tags yet. Create them under Organize.
          </p>
        )}
      </div>
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
              loading={busy}
              onClick={async () => {
                await run({ kind: "delete" }, `Deleted ${count} question(s).`);
                setConfirmDelete(false);
                setTyped("");
              }}
            >
              Delete {count} question{count === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0">
            This permanently deletes {count} question{count === 1 ? "" : "s"}, with their bookmarks,
            notes and revision cards. Sessions you finished keep their own copy of the question. It
            cannot be undone.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Type DELETE to confirm
            <input className="lv-input" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
        </div>
      </Dialog>
    </>
  );
}
