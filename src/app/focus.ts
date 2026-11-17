import { useEffect, useSyncExternalStore } from "react";

/**
 * Focus mode hides the tab bar and header on phones while a practice session or exam is open,
 * so nothing pulls the student away mid-question.
 */
let focused = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (focused === next) return;
  focused = next;
  listeners.forEach((l) => l());
}

export function useFocusMode(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => focused,
    () => false,
  );
}

/** Turns focus mode on while the calling screen is mounted. */
export function useRequestFocus() {
  useEffect(() => {
    set(true);
    return () => set(false);
  }, []);
}
