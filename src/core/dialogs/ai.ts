import { createStore } from "../store.ts";

/** Whether the AI connection dialog is open. */
const open = createStore(false);

export const openAiConnection = () => open.set(true);
export const closeAiConnection = () => open.set(false);
export const useAiDialogOpen = open.use;
