import { createStore } from "./store.ts";

/** One short confirmation at a time ("3 questions deleted"). Newer messages replace older ones. */
export interface Toast {
  id: number;
  message: string;
  /** A button on the toast, such as Undo. Pressing it also closes the toast. */
  action?: { label: string; run: () => void };
}

const store = createStore<Toast | null>(null);
let counter = 0;

export function showToast(message: string, action?: Toast["action"]) {
  counter += 1;
  store.set({ id: counter, message, action });
}
export function dismissToast(id?: number) {
  const current = store.get();
  if (current && (id === undefined || current.id === id)) store.set(null);
}
export const useToast = store.use;
