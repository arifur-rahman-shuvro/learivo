import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** The current page address after the #, kept in step with the browser's Back button. */
export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
}

/** "#/review/flashcards" with base "#/review" gives "flashcards"; anything else gives null. */
export function subPage(hash: string, base: string): string | null {
  if (!hash.startsWith(`${base}/`)) return null;
  const rest = hash.slice(base.length + 1).split("?")[0] ?? "";
  return rest === "" ? null : rest;
}
