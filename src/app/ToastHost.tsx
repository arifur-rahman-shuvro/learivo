import { useEffect } from "react";
import { dismissToast, useToast } from "./toast.ts";

const SHOW_MS = 4000;
/** A toast with a button stays longer, so there is time to press it. */
const SHOW_WITH_ACTION_MS = 8000;

/** Shows the current toast above the bottom bar, then removes it. Mounted once in the shell. */
export default function ToastHost() {
  const toast = useToast();
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(
      () => dismissToast(toast.id),
      toast.action ? SHOW_WITH_ACTION_MS : SHOW_MS,
    );
    return () => window.clearTimeout(t);
  }, [toast]);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6"
    >
      {toast && (
        <p
          key={toast.id}
          className="lv-rise-in pointer-events-auto m-0 flex max-w-md items-center gap-3 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold shadow-lg"
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
