import { forgetAllKeys } from "../modules/ai/keys.ts";
import { useOfflineControls } from "../platform/offline/OfflineProvider.tsx";

/** Removes what this phone keeps for the signed-in student: offline copy, caches and AI keys. */
export function useClearDeviceData() {
  const offline = useOfflineControls();
  return async () => {
    await offline?.pack.clear().catch(() => undefined);
    await offline?.sync.clearCaches().catch(() => undefined);
    forgetAllKeys(); // AI keys belong to this device only
  };
}
