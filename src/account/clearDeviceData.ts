import { forgetAllKeys } from "../modules/ai/keys.ts";
import { useOfflineControls } from "../platform/offline/OfflineProvider.tsx";
import { UnsentChangesError } from "../platform/offline/pack.ts";

/** Removes what this phone keeps for the signed-in student: offline copy, caches and AI keys. */
export function useClearDeviceData() {
  const offline = useOfflineControls();
  /** Refuses (UnsentChangesError) while offline changes are unsent, unless told to discard them. */
  return async (opts: { discardUnsent?: boolean } = {}) => {
    const ws = offline?.ws;
    if (ws) {
      if ((await ws.waiting()) > 0 && navigator.onLine) await ws.flush().catch(() => undefined);
      if ((await ws.waiting()) > 0 && !opts.discardUnsent)
        throw new UnsentChangesError(await ws.pendingSummaries());
    }
    await offline?.pack.clear(opts);
    await ws?.clear();
    await offline?.sync.clearCaches().catch(() => undefined);
    forgetAllKeys(); // AI keys belong to this device only
  };
}
