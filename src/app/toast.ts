import { useSyncExternalStore } from "react";

/** One short confirmation at a time ("3 questions deleted"). Newer messages replace older ones. */
export interface Toast {
  id: number;
  message: string;
  /** A button on the toast, such as Undo. Pressing it also closes the toast. */
  action?: { label: string; run: () => void };
}

let current: Toast | null = null;
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(message: string, action?: Toast["action"]) {
  counter += 1;
  current = { id: counter, message, action };
  emit();
}
export function dismissToast(id?: number) {
  if (current && (id === undefined || current.id === id)) {
    current = null;
    emit();
  }
}
export function useToast(): Toast | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}
