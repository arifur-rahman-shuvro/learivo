import { clock, elapsedMs, isRunning, remainingMs } from "../domain/engine.ts";
import { useFocus, useNow } from "./FocusProvider.tsx";

/**
 * A small timer that stays on every other screen while a session exists, so the student can
 * pause it or go back to it without losing their place.
 */
export function FocusPill({ onOpen }: { onOpen: () => void }) {
  const { controller: c, state } = useFocus();
  const t = state.active;
  const running = !!t && isRunning(t);
  const now = useNow(running);
  if (!t) return null;
  const left = remainingMs(t, now);
  const shown = left === null ? clock(elapsedMs(t, now)) : clock(left, "up");
  const label = t.phase === "focus" ? "Focus" : "Break";
  return (
    <div
      role="group"
      aria-label="Focus timer"
      className="fixed right-3 z-40 flex items-center gap-1 rounded-pill border border-line-strong bg-surface-1 py-1 pl-3 pr-1 shadow-[var(--lv-shadow-raised)] bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex items-baseline gap-2 bg-transparent p-1 text-left"
        aria-label={`${label} timer, ${shown}. Open Study`}
      >
        <span className="font-mono text-base font-semibold tabular-nums">{shown}</span>
        <span className="text-xs text-muted">
          {label}
          {!running && " · paused"}
        </span>
      </button>
      <button
        type="button"
        className="lv-btn lv-btn-primary lv-btn-sm"
        onClick={() => (running ? c.pause() : c.resume())}
      >
        {running ? "Pause" : "Resume"}
      </button>
    </div>
  );
}
