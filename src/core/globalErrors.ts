import { describeError, isQuiet } from "./errors.ts";
import { reportError } from "./monitoring.ts";
import { noteError } from "./support.ts";
import { showToast } from "./toast.ts";

/**
 * Catches failures nobody handled (a request that rejected after the screen moved on, say).
 * They are reported, and the student gets one short message instead of silence.
 */
export function installGlobalErrorHandlers(target: Window = window): () => void {
  let lastShown = 0;
  const onRejection = (ev: PromiseRejectionEvent) => {
    if (isQuiet(ev.reason)) return;
    reportError(ev.reason);
    const now = Date.now();
    if (now - lastShown < 5000) return; // one message at a time
    lastShown = now;
    const d = describeError(ev.reason);
    showToast(`${d.title} ${d.advice}`);
  };
  const onError = (ev: ErrorEvent) => noteError(ev.error ?? ev.message);
  target.addEventListener("unhandledrejection", onRejection);
  target.addEventListener("error", onError);
  return () => {
    target.removeEventListener("unhandledrejection", onRejection);
    target.removeEventListener("error", onError);
  };
}
