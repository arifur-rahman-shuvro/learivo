import { useEffect } from "react";
import { createStore } from "./store.ts";

/**
 * Focus mode hides the tab bar and header on phones while a practice session or exam is open,
 * so nothing pulls the student away mid-question.
 */
const focused = createStore(false);

export const useFocusMode = focused.use;

/** Turns focus mode on while the calling screen is mounted. */
export function useRequestFocus() {
  useEffect(() => {
    focused.set(true);
    return () => focused.set(false);
  }, []);
}
