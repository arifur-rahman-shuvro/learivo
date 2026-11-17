import { useEffect } from "react";
import { dismissToast, useToast } from "./toast.ts";

const SHOW_MS = 4000;

/** Shows the current toast above the bottom bar, then removes it. Mounted once in the shell. */
export default function ToastHost() {
  const toast = useToast();
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => dismissToast(toast.id), SHOW_MS);
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
          className="lv-rise-in pointer-events-auto m-0 max-w-md rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold shadow-lg"
        >
          {toast.message}
        </p>
      )}
    </div>
  );
}
