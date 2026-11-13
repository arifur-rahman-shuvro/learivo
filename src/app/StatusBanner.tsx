import { Button } from "../design-system/index.ts";
import { useOnline, useUpdate } from "../pwa/pwa.ts";

/** Tells the student about being offline and about a new version, without blocking anything. */
export default function StatusBanner() {
  const online = useOnline();
  const update = useUpdate();
  if (online && !update.ready) return null;
  return (
    <div className="flex flex-col gap-2">
      {!online && (
        <p
          role="status"
          className="m-0 rounded-control border border-line bg-surface-2 px-3 py-2 text-sm font-medium"
        >
          You are offline. Anything saved on this device syncs when you are back online.
        </p>
      )}
      {update.ready && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-accent bg-surface-2 px-3 py-2 text-sm font-medium"
        >
          <span>A new version of Learivo is ready.</span>
          <Button size="sm" onClick={update.apply}>
            Update now
          </Button>
        </div>
      )}
    </div>
  );
}
