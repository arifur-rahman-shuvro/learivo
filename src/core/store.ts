import { useSyncExternalStore } from "react";

/**
 * A tiny shared value that any part of the app can read, change and watch. It is used for
 * things that are not worth a screen's own state: "is the guide open", "which toast is showing".
 *
 *   const guide = createStore(false);
 *   guide.set(true);        // from anywhere
 *   const open = guide.use(); // in a component, re-renders when it changes
 */
export interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  /** Calls back after every change. Returns a function that stops listening. */
  subscribe: (cb: () => void) => () => void;
  /** React hook: the current value, and a re-render when it changes. */
  use: () => T;
}

export function createStore<T>(initial: T, serverValue: T = initial): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => void listeners.delete(cb);
  };
  return {
    get: () => value,
    subscribe,
    set: (next) => {
      if (Object.is(value, next)) return;
      value = next;
      listeners.forEach((l) => l());
    },
    use: () =>
      useSyncExternalStore(
        subscribe,
        () => value,
        () => serverValue,
      ),
  };
}
