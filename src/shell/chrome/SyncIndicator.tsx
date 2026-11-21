import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button, Dialog } from "../../ui-kit/index.ts";
import { useOfflineControls } from "../../platform/offline/OfflineProvider.tsx";
import type { PackStatus } from "../../platform/offline/pack.ts";
import { useOnline } from "../../platform/pwa/pwa.ts";
import { showToast } from "../../core/toast.ts";
import ConflictsPanel from "./ConflictsPanel.tsx";

const IDLE = { waiting: 0, syncing: false, problem: null };
const NO_RETRY = { attempt: 0, nextAt: null };

type Tone = "ok" | "busy" | "warn";

const dot: Record<Tone, string> = {
  ok: "bg-[var(--lv-success,#16a34a)]",
  busy: "bg-[var(--lv-accent)]",
  warn: "bg-[var(--lv-danger,#dc2626)]",
};

function when(iso: string | null) {
  if (!iso) return "not downloaded";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Shows whether everything is saved, and opens the offline settings. */
export default function SyncIndicator() {
  const controls = useOfflineControls();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [pack, setPack] = useState<PackStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [wsWaiting, setWsWaiting] = useState(0);

  const subscribe = useCallback(
    (fn: () => void) => (controls ? controls.sync.subscribe(fn) : () => undefined),
    [controls],
  );
  const state = useSyncExternalStore(subscribe, () => controls?.sync.getState() ?? IDLE);
  const subscribeRetry = useCallback(
    (fn: () => void) => (controls?.retry ? controls.retry.subscribe(fn) : () => undefined),
    [controls],
  );
  const retry = useSyncExternalStore(subscribeRetry, () => controls?.retry?.getState() ?? NO_RETRY);

  useEffect(() => {
    if (!controls) return;
    const load = () => {
      void controls.pack.status().then(setPack);
      void Promise.all([
        controls.pack.pendingSummaries(),
        controls.ws?.pendingSummaries() ?? Promise.resolve([] as string[]),
      ]).then(([a, b]) => {
        setLines([...a, ...b]);
        setWsWaiting(b.length);
      });
    };
    load();
    const off = [controls.pack.subscribe(load), controls.ws?.subscribe(load)];
    return () => off.forEach((f) => f?.());
  }, [controls]);

  const clashes = pack?.conflicts.length ?? 0;
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    // Tell the student once when new clashes appear, wherever they are in the app.
    if (clashes > seen)
      showToast("Some offline edits clash with changes made elsewhere. Open Saved to decide.");
    setSeen(clashes);
  }, [clashes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!controls) return null;

  let label = "Saved";
  let tone: Tone = "ok";
  if (state.problem) [label, tone] = ["Needs attention", "warn"];
  else if (clashes > 0) [label, tone] = [`${clashes} to decide`, "warn"];
  else if (state.syncing) [label, tone] = ["Syncing", "busy"];
  else if (state.waiting + (pack?.waiting ?? 0) + wsWaiting > 0) {
    [label, tone] = [`${state.waiting + (pack?.waiting ?? 0) + wsWaiting} waiting to sync`, "busy"];
  } else if ((pack?.failed.length ?? 0) > 0) [label, tone] = ["Needs attention", "warn"];
  else if (!online) [label, tone] = ["Offline", "warn"];

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setNote(done);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="lv-btn lv-btn-ghost lv-btn-sm"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden className={`inline-block size-2 rounded-full ${dot[tone]}`} />
        <span aria-live="polite">{label}</span>
      </button>
      <Dialog open={open} title="Offline and sync" onClose={() => setOpen(false)} variant="modal">
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-1">
            <h3 className="m-0 text-base font-semibold">Your sessions</h3>
            <p className="m-0 text-sm text-muted">
              {!online
                ? "You are offline. Practice and exams still work and are saved on this device."
                : state.waiting > 0
                  ? `${state.waiting} finished session${state.waiting === 1 ? "" : "s"} will be sent shortly.`
                  : "Everything is saved to your account."}
            </p>
            {state.problem && (
              <p role="alert" className="m-0 text-sm font-medium">
                Last problem: {state.problem}
              </p>
            )}
            <div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !online || state.syncing}
                onClick={() => void act(() => controls.sync.sync(), "Sync finished.")}
              >
                Sync now
              </Button>
            </div>
          </section>

          {pack && (pack.conflicts.length > 0 || pack.resolved.length > 0) && (
            <ConflictsPanel
              status={pack}
              busy={busy}
              onResolve={(id, choice) =>
                void act(() => controls.pack.resolveConflict(id, choice), "Decision applied.")
              }
              onReapply={(i, side) =>
                void act(() => controls.pack.reapply(i, side), "That version is back.")
              }
            />
          )}

          <section className="flex flex-col gap-1">
            <h3 className="m-0 text-base font-semibold">Questions on this device</h3>
            <p className="m-0 text-sm text-muted">
              {pack?.savedAt
                ? `${pack.count} question${pack.count === 1 ? "" : "s"}, updated ${when(pack.savedAt)}. Used when you have no connection.`
                : pack?.enabled === false
                  ? "No copy is kept on this device."
                  : "A copy is downloaded the next time you are online."}
            </p>
            <p className="m-0 text-sm text-muted">
              {pack?.savedAt
                ? "With this copy you can read, practise and add, edit, archive, tag and move questions offline. Changes are sent when you are back online. Subjects, tags and collections can be added, renamed, merged and deleted offline too."
                : "Download the copy to use your questions, and edit them, without a connection."}
            </p>
            {(pack?.waiting ?? 0) + wsWaiting > 0 && (
              <p className="m-0 text-sm font-medium">
                {(pack?.waiting ?? 0) + wsWaiting} change
                {(pack?.waiting ?? 0) + wsWaiting === 1 ? "" : "s"} made offline will be sent when
                you are online.
              </p>
            )}
            {(pack?.waiting ?? 0) + wsWaiting > 0 && lines.length > 0 && (
              <ul aria-label="Waiting changes" className="m-0 pl-5 text-sm text-muted">
                {lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            {(pack?.waiting ?? 0) + wsWaiting > 0 && retry.nextAt !== null && (
              <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
                <span role="status">
                  Could not send yet. Trying again in about{" "}
                  {Math.max(1, Math.round((retry.nextAt - Date.now()) / 1000))} seconds.
                </span>
                <Button size="sm" variant="ghost" onClick={() => controls.retry?.kick()}>
                  Try now
                </Button>
              </p>
            )}
            {(pack?.failed.length ?? 0) > 0 && (
              <div role="alert" className="flex flex-col gap-1 text-sm">
                <p className="m-0 font-medium">These offline changes could not be saved:</p>
                <ul className="m-0 pl-5">
                  {pack!.failed.map((f, i) => (
                    <li key={i}>
                      {f.summary}. {f.message}
                    </li>
                  ))}
                </ul>
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void act(() => controls.pack.dismissFailed(), "Cleared.")}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !online}
                onClick={() => void act(() => controls.pack.download(), "Copy updated.")}
              >
                {pack?.savedAt ? "Update copy" : "Download copy"}
              </Button>
              {pack?.savedAt && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void act(() => controls.pack.remove(), "Copy removed.")}
                >
                  Remove copy
                </Button>
              )}
            </div>
          </section>
          {note && (
            <p role="status" className="m-0 text-sm font-medium">
              {note}
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
