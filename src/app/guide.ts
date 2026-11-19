import { createStore } from "../core/store.ts";

/** Whether the user guide is open. A tiny store so the menu, Home and All features can all open it. */
const open = createStore(false);

export const openGuide = () => open.set(true);
export const closeGuide = () => open.set(false);
export const useGuideOpen = open.use;
