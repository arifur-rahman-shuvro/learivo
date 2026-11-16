import { useSyncExternalStore } from "react";

/** Whether the backup dialog is open. Lets Settings and All features open it. */
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openBackup() {
  open = true;
  emit();
}
export function closeBackup() {
  open = false;
  emit();
}
export function useBackupOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => open,
    () => false,
  );
}
