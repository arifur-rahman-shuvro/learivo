import { useState } from "react";
import { Button, Dialog } from "../../../design-system/index.ts";
import { errorText } from "../../question-bank/ui/bank.tsx";
import type { Note } from "../data/repo.ts";
import { useWorkspace } from "./workspace.tsx";

interface Props {
  /** The question the note is about; null for a free note. */
  questionId: string | null;
  /** Shown above the box so the student knows what the note is about. */
  about?: string;
  note: Note | null;
  onClose: () => void;
}

export default function NoteDialog({ questionId, about, note, onClose }: Props) {
  const { repo, refresh } = useWorkspace();
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    if (body.trim() === "") return setError("Write something in the note.");
    setBusy(true);
    setError(undefined);
    try {
      await repo.saveNote({ id: note?.id ?? null, questionId, title: title.trim(), body });
      refresh();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function remove() {
    if (!note) return;
    setBusy(true);
    try {
      await repo.deleteNote(note.id);
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
      title={note ? "Edit note" : "New note"}
      onClose={onClose}
      footer={
        <>
          {note && (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete note
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            Save note
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {about && <p className="m-0 line-clamp-3 text-sm text-muted">{about}</p>}
        {error && (
          <p
            role="alert"
            className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        {questionId === null && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Title (optional)
            <input
              className="lv-input"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Note
          <textarea
            className="lv-input"
            style={{ minHeight: "10rem" }}
            value={body}
            maxLength={10000}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
      </div>
    </Dialog>
  );
}
