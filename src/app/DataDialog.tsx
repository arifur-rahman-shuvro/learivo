import { useEffect, useState } from "react";
import { Button, Dialog } from "../design-system/index.ts";
import { useDataRepo, useOfflineControls } from "../offline/OfflineProvider.tsx";
import type { ClearScope, DataCounts } from "../modules/data/data/repo.ts";

const n = (x: number, one: string, many = `${one}s`) =>
  `${x.toLocaleString()} ${x === 1 ? one : many}`;

const ACTIONS: {
  scope: ClearScope;
  title: string;
  button: string;
  describe: (c: DataCounts) => string;
  warn: string;
}[] = [
  {
    scope: "practice",
    title: "Clear practice history",
    button: "Clear history",
    describe: (c) =>
      `${n(c.sessions, "session")} with their answers and scores. Your questions stay. Insights and streaks start again.`,
    warn: "all sessions, answers and scores",
  },
  {
    scope: "questions",
    title: "Delete all questions",
    button: "Delete questions",
    describe: (c) =>
      `${n(c.questions, "question")}, with ${n(c.bookmarks, "bookmark")}, ${n(c.notes, "note")} and ${n(c.cards, "revision card")} attached to them. Past sessions stay.`,
    warn: "every question, and the bookmarks, notes and revision cards attached to them",
  },
  {
    scope: "everything",
    title: "Delete everything",
    button: "Delete everything",
    describe: (c) =>
      `All of the above, plus ${n(c.exams, "saved exam")}, subjects, tags and collections. Only your account and appearance settings stay.`,
    warn: "all questions, sessions, exams, notes, bookmarks, revision cards, subjects, tags and collections",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after clearing finishes and the dialog is closed. Defaults to reloading the page. */
  onCleared?: () => void;
}

/** Counts of what is stored, and permanent clearing behind a typed confirmation. */
export default function DataDialog({ open, onClose, onCleared = () => location.reload() }: Props) {
  const data = useDataRepo();
  const offline = useOfflineControls();
  const [counts, setCounts] = useState<DataCounts | null>(null);
  const [pick, setPick] = useState<(typeof ACTIONS)[number] | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open || !data) return;
    setPick(null);
    setTyped("");
    setDone(false);
    setError(undefined);
    setProgress([]);
    setCounts(null);
    data
      .counts()
      .then(setCounts, (e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load."),
      );
  }, [open, data]);

  if (!data) return null;

  async function run() {
    if (!pick || !data) return;
    setBusy(true);
    setError(undefined);
    setProgress([]);
    try {
      await data.clear(pick.scope, (label) => setProgress((p) => [...p, label]));
      // The copy on this device would otherwise still show what was just deleted.
      if (pick.scope !== "practice") await offline?.pack.clear();
      if (pick.scope !== "questions") await offline?.sync.discardLocal();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const finish = () => {
    onClose();
    if (done) onCleared();
  };

  return (
    <Dialog open={open} variant="modal" title="Your data" onClose={busy ? () => undefined : finish}>
      {done ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="m-0 font-medium">
            Done. {pick?.title} finished.
          </p>
          <div>
            <Button onClick={finish}>Close</Button>
          </div>
        </div>
      ) : pick ? (
        <div className="flex flex-col gap-3">
          <p className="m-0">This permanently deletes {pick.warn}. It cannot be undone.</p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Type DELETE to confirm
            <input
              className="lv-input"
              value={typed}
              autoCapitalize="characters"
              autoComplete="off"
              disabled={busy}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
          {busy && (
            <p role="status" className="m-0 text-sm text-muted">
              Deleting… {progress.length > 0 && `${progress.join(", ")} done.`}
            </p>
          )}
          {error && (
            <p role="alert" className="m-0 text-sm font-medium">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setPick(null)}>
              Back
            </Button>
            <Button
              variant="danger"
              disabled={typed !== "DELETE"}
              loading={busy}
              onClick={() => void run()}
            >
              {pick.button}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-sm text-muted">
            Want a copy first? Use Export on the Questions screen. Deleting is permanent.
          </p>
          {error && (
            <p role="alert" className="m-0 text-sm font-medium">
              {error}
            </p>
          )}
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {ACTIONS.map((a) => (
              <li
                key={a.scope}
                className="flex flex-col gap-2 rounded-control border border-line p-3"
              >
                <h3 className="m-0 text-base font-semibold">{a.title}</h3>
                <p className="m-0 text-sm text-muted">
                  {counts ? a.describe(counts) : "Counting…"}
                </p>
                <div>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!counts}
                    onClick={() => {
                      setPick(a);
                      setTyped("");
                    }}
                  >
                    {a.button}…
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
