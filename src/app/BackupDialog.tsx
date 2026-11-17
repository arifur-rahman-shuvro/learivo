import { useRef, useState } from "react";
import { Button, Dialog } from "../design-system/index.ts";
import { useBank, errorText } from "../modules/question-bank/ui/bank.tsx";
import { usePractice } from "../modules/practice/ui/practice.tsx";
import { useWorkspace } from "../modules/workspace/ui/workspace.tsx";
import {
  buildBackup,
  parseBackup,
  previewRestore,
  restoreBackup,
  type Backup,
  type RestoreResult,
} from "./backupData.ts";
import { markBackedUp } from "./backupReminder.ts";
import { closeBackup, useBackupOpen } from "./backupStore.ts";

function readText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

function save(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Preview {
  backup: Backup;
  newQuestions: number;
  existing: number;
  invalid: number;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** One file with everything: questions, notes, bookmarks, flashcards, glossary and your targets. */
export default function BackupDialog() {
  const open = useBackupOpen();
  const { repo: bank, refresh: refreshBank } = useBank();
  const { repo: ws, refresh: refreshWs } = useWorkspace();
  const { attempts, refresh: refreshPractice } = usePractice();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);

  const close = () => {
    setPreview(null);
    setResult(null);
    setMessage(null);
    setError(null);
    closeBackup();
  };

  const download = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const b = await buildBackup(bank, ws, attempts);
      save(
        `learivo-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(b, null, 2),
      );
      markBackedUp();
      setMessage(
        `Saved ${plural(b.questions.length, "question")}, ${plural(b.notes.length, "note")}, ` +
          `${plural(b.flashcards.length, "flashcard")}, ${plural(b.glossary.length, "glossary term")}, ` +
          `${plural(b.attempts.length, "finished session")} and ${plural(b.cards.length, "revision card")}.`,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setResult(null);
    setPreview(null);
    try {
      const parsed = parseBackup(await readText(file));
      if (!parsed.ok) {
        setError(parsed.error);
      } else {
        setPreview({ backup: parsed.backup, ...(await previewRestore(parsed.backup, bank)) });
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const restore = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    const r = await restoreBackup(preview.backup, bank, ws, attempts);
    setBusy(false);
    setPreview(null);
    setResult(r);
    refreshBank();
    refreshWs();
    refreshPractice();
  };

  return (
    <Dialog
      open={open}
      variant="modal"
      title="Back up and restore"
      onClose={close}
      footer={<Button onClick={close}>Done</Button>}
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-semibold">Save a backup</h3>
          <p className="m-0 text-sm text-muted">
            One file with your questions, notes, bookmarks, flashcards, glossary, exam goals, saved
            exams, finished practice and exam sessions (the latest 500) and your revision schedule.
            Keep the file somewhere safe.
          </p>
          <div>
            <Button variant="secondary" size="sm" disabled={busy} onClick={download}>
              Download backup
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-semibold">Restore from a backup</h3>
          <p className="m-0 text-sm text-muted">
            Choose a backup file to see what it would add. Restoring only adds what is missing. It
            never changes or deletes what you already have.
          </p>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              aria-label="Choose backup file"
              className="text-sm"
              disabled={busy}
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </div>
        </section>

        {preview && (
          <section
            aria-label="Restore preview"
            className="flex flex-col gap-2 rounded-control border border-line p-3"
          >
            <p className="m-0 text-sm font-semibold">This backup would add:</p>
            <ul className="m-0 pl-5 text-sm">
              <li>{plural(preview.newQuestions, "new question")}</li>
              <li>
                {plural(preview.backup.notes.length, "note")} (those already saved are skipped)
              </li>
              <li>{plural(preview.backup.flashcards.length, "flashcard")} (duplicates skipped)</li>
              <li>
                {plural(preview.backup.glossary.length, "glossary term")} (duplicates skipped)
              </li>
              {preview.backup.attempts.length > 0 && (
                <li>
                  {plural(preview.backup.attempts.length, "finished session")} of practice and exams
                  (those already here are skipped)
                </li>
              )}
              {preview.backup.exams.length > 0 && (
                <li>{plural(preview.backup.exams.length, "saved exam")}</li>
              )}
              {preview.backup.cards.length > 0 && (
                <li>{plural(preview.backup.cards.length, "revision card")} with their schedule</li>
              )}
            </ul>
            {preview.existing > 0 && (
              <p className="m-0 text-sm text-muted">
                {plural(preview.existing, "question")} already in your bank will be skipped.
              </p>
            )}
            {preview.invalid > 0 && (
              <p className="m-0 text-sm text-warning">
                {plural(preview.invalid, "question")} in the file cannot be read and will be
                skipped.
              </p>
            )}
            <div>
              <Button size="sm" disabled={busy} onClick={() => void restore()}>
                Restore now
              </Button>
            </div>
          </section>
        )}

        {result && (
          <section
            aria-label="Restore result"
            role="status"
            className="flex flex-col gap-1 text-sm"
          >
            <p className="m-0 font-semibold">
              {result.failure ? "Restore stopped part-way." : "Restore finished."}
            </p>
            <p className="m-0">
              Added {plural(result.questions, "question")}, {plural(result.notes, "note")},{" "}
              {plural(result.bookmarks, "bookmark")}, {plural(result.flashcards, "flashcard")} and{" "}
              {plural(result.glossary, "glossary term")}.
              {(result.attempts > 0 || result.exams > 0 || result.cards > 0) && (
                <>
                  {" "}
                  Also {plural(result.attempts, "finished session")},{" "}
                  {plural(result.exams, "saved exam")} and {plural(result.cards, "revision card")}.
                </>
              )}
            </p>
            {result.failure && <p className="m-0 text-danger">{result.failure}</p>}
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
