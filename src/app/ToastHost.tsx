import { useEffect, useState } from "react";
import { canAnimate } from "../motion/index.ts";
import { dismissToast, useToast } from "./toast.ts";

const SHOW_MS = 4000;
/** A toast with a button stays longer, so there is time to press it. */
const SHOW_WITH_ACTION_MS = 8000;

/** Shows the current toast above the bottom bar, then removes it. Mounted once in the shell. */
export default function ToastHost() {
  const current = useToast();
  // Keep the last toast on screen while it plays its exit.
  const [shown, setShown] = useState(current);
  const [leaving, setLeaving] = useState(false);
  if (current && current !== shown) {
    setShown(current);
    setLeaving(false);
  } else if (!current && shown) {
    if (!canAnimate()) setShown(null);
    else if (!leaving) setLeaving(true);
  }
  const toast = leaving ? shown : current;
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, 180);
    return () => window.clearTimeout(t);
  }, [leaving]);
  useEffect(() => {
    if (!toast || leaving) return;
    const t = window.setTimeout(
      () => dismissToast(toast.id),
      toast.action ? SHOW_WITH_ACTION_MS : SHOW_MS,
    );
    return () => window.clearTimeout(t);
  }, [toast, leaving]);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6"
    >
      {toast && (
        <p
          key={toast.id}
          className={`${leaving ? "lv-toast-out pointer-events-none" : "lv-toast-in pointer-events-auto"} m-0 flex max-w-md items-center gap-3 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold shadow-lg`}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="shrink-0 rounded-control px-2 py-1 font-bold text-accent"
              onClick={() => {
                toast.action!.run();
                dismissToast(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
