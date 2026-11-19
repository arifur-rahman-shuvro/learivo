import { createStore } from "../core/store.ts";

/** Whether the backup dialog is open. Lets Settings and All features open it. */
const open = createStore(false);

export const openBackup = () => open.set(true);
export const closeBackup = () => open.set(false);
export const useBackupOpen = open.use;
