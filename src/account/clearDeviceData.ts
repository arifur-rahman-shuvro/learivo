import { forgetAllKeys } from "../modules/ai/keys.ts";
import { useOfflineControls } from "../platform/offline/OfflineProvider.tsx";

/** Removes what this phone keeps for the signed-in student: offline copy, caches and AI keys. */
export function useClearDeviceData() {
  const offline = useOfflineControls();
  /** Refuses (UnsentChangesError) while offline changes are unsent, unless told to discard them. */
  return async (opts: { discardUnsent?: boolean } = {}) => {
    await offline?.pack.clear(opts);
    await offline?.sync.clearCaches().catch(() => undefined);
    forgetAllKeys(); // AI keys belong to this device only
  };
}
