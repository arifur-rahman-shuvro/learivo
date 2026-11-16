import { useSyncExternalStore } from "react";

/** Whether the user guide is open. A tiny store so the menu, Home and All features can all open it. */
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openGuide() {
  open = true;
  emit();
}
export function closeGuide() {
  open = false;
  emit();
}
export function useGuideOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => open,
    () => false,
  );
}
