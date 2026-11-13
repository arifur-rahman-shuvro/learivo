import { useEffect, useRef } from "react";

/** A request made from outside a screen, such as the command palette: "open the add form". */
export type Intent = { kind: "search"; text: string } | { kind: "add" } | { kind: "import" };

let pending: Intent | null = null;
const listeners = new Set<() => void>();

/** Remember an intent for the screen that is about to open (or is already open). */
export function sendIntent(intent: Intent) {
  pending = intent;
  listeners.forEach((l) => l());
}

/** Runs the handler for an intent waiting when the screen opens, and for any that arrive later. */
export function useIntent(handler: (intent: Intent) => void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const take = () => {
      if (!pending) return;
      const p = pending;
      pending = null;
      latest.current(p);
    };
    take();
    listeners.add(take);
    return () => void listeners.delete(take);
  }, []);
}
