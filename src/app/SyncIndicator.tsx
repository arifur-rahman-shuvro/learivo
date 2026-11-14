import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button, Dialog } from "../design-system/index.ts";
import { useOfflineControls } from "../offline/OfflineProvider.tsx";
import type { PackStatus } from "../offline/pack.ts";
import { useOnline } from "../pwa/pwa.ts";

const IDLE = { waiting: 0, syncing: false, problem: null };

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

  const subscribe = useCallback(
    (fn: () => void) => (controls ? controls.sync.subscribe(fn) : () => undefined),
    [controls],
  );
  const state = useSyncExternalStore(subscribe, () => controls?.sync.getState() ?? IDLE);

  useEffect(() => {
    if (!controls) return;
    const load = () => void controls.pack.status().then(setPack);
    load();
    return controls.pack.subscribe(load);
  }, [controls]);

  if (!controls) return null;

  let label = "Saved";
  let tone: Tone = "ok";
  if (state.problem) [label, tone] = ["Needs attention", "warn"];
  else if (state.syncing) [label, tone] = ["Syncing", "busy"];
  else if (state.waiting > 0) [label, tone] = [`${state.waiting} waiting to sync`, "busy"];
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
              Editing the bank needs a connection. Reading, practice and exams do not.
            </p>
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
