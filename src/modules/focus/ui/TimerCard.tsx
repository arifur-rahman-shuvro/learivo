import { useEffect, useState } from "react";
import { Button, Segmented } from "../../../ui-kit/index.ts";
import {
  clock,
  cleanPlan,
  elapsedMs,
  isRunning,
  plannedMs,
  progress,
  remainingMs,
  type TimerMode,
  type TimerPlan,
} from "../domain/engine.ts";
import { BUILT_IN_PRESETS, MODE_LABEL } from "../domain/settings.ts";
import { FlipScreen } from "./FlipClock.tsx";
import { Num } from "./Num.tsx";
import { useFocus, useNow } from "./FocusProvider.tsx";

const MODES: TimerMode[] = ["pomodoro", "stopwatch", "countdown", "custom"];

/** The ring and the big digits. Time is read from the engine on every paint, never counted. */
function Face() {
  const { state } = useFocus();
  const t = state.active!;
  const running = isRunning(t);
  const now = useNow(running);
  const left = remainingMs(t, now);
  const digits = left === null ? clock(elapsedMs(t, now)) : clock(left, "up");
  const ring = state.settings.display === "ring";
  const size = 248;
  const r = 52;
  const c = 2 * Math.PI * r;
  const p = progress(t, now);
  const isBreak = t.phase !== "focus";
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {ring && (
          <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="var(--lv-surface-3)"
              strokeWidth="6"
            />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={isBreak ? "var(--lv-success)" : "var(--lv-accent)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - p)}
              transform="rotate(-90 60 60)"
              style={{ filter: "var(--lv-ring-glow, none)" }}
            />
          </svg>
        )}
        <div
          className={`${ring ? "absolute" : ""} font-mono font-semibold tabular-nums leading-none`}
          style={{ fontSize: ring ? 48 : 72, opacity: running ? 1 : 0.7 }}
          role="timer"
          aria-label={left === null ? "Time studied" : "Time left"}
        >
          {digits}
        </div>
      </div>
      {state.settings.showProgressBar && (
        <div
          role="progressbar"
          aria-label="Phase progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(p * 100)}
          className="h-1.5 w-full max-w-xs overflow-hidden rounded-pill bg-surface-3"
        >
          <div
            className={`h-full rounded-pill ${isBreak ? "bg-success" : "bg-accent"}`}
            style={{ width: `${p * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Full screen: black, flipping digits, nothing else. Time is read from the engine on every paint. */
function Immersive({ onExit }: { onExit: () => void }) {
  const { controller: c, state } = useFocus();
  const t = state.active!;
  const running = isRunning(t);
  const now = useNow(running);
  const left = remainingMs(t, now);
  const text = left === null ? clock(elapsedMs(t, now)) : clock(left, "up");
  return (
    <FlipScreen
      text={text}
      label={`${left === null ? "Time studied" : "Time left"} ${text}`}
      running={running}
      onToggle={() => (running ? c.pause() : c.resume())}
      onExit={onExit}
    />
  );
}

function phaseLabel(t: NonNullable<ReturnType<typeof useFocus>["state"]["active"]>): string {
  if (t.phase === "short") return "Short break";
  if (t.phase === "long") return "Long break";
  if (t.plan.mode === "stopwatch") return "Stopwatch";
  if (t.plan.mode === "countdown") return "Countdown";
  return `Focus ${t.done + 1}`;
}

export function TimerCard({
  immersive,
  onImmersive,
}: {
  immersive: boolean;
  onImmersive: (on: boolean) => void;
}) {
  const { controller: c, state } = useFocus();
  const { settings, active } = state;
  const [draft, setDraft] = useState<TimerPlan>(settings.plan);
  useEffect(() => setDraft(settings.plan), [settings.plan]);
  const set = (patch: Partial<TimerPlan>) => setDraft((d) => cleanPlan({ ...d, ...patch }) ?? d);
  const presets = [...BUILT_IN_PRESETS, ...settings.presets];

  const begin = () => {
    if (JSON.stringify(draft) !== JSON.stringify(settings.plan))
      void c.saveSettings({ ...settings, plan: draft });
    c.begin(draft);
  };

  if (!active) {
    return (
      <section aria-label="Timer" className="lv-card flex flex-col gap-5 p-5">
        <Segmented
          label="Timer mode"
          hideLabel
          value={draft.mode}
          options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
          onChange={(v) => set({ mode: v as TimerMode })}
        />
        <div className="flex flex-col items-center gap-1 py-4">
          <div className="font-mono text-6xl font-semibold tabular-nums leading-none text-muted">
            {draft.mode === "stopwatch" ? "00:00" : clock(draft.focusMin * 60_000)}
          </div>
          <p className="m-0 mt-2 text-sm text-muted">
            {draft.mode === "stopwatch"
              ? "Counts up until you finish."
              : draft.mode === "countdown"
                ? "One focus, then done."
                : `${draft.focusMin} min focus, ${draft.shortMin} min break, long break of ${draft.longMin} min after ${draft.cycles}.`}
          </p>
        </div>

        {(draft.mode === "pomodoro" || draft.mode === "custom") && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Presets">
            {presets.map((p) => {
              const on = JSON.stringify({ ...p.plan, mode: draft.mode }) === JSON.stringify(draft);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  className={`lv-btn lv-btn-sm ${on ? "lv-btn-primary" : "lv-btn-secondary"}`}
                  onClick={() => setDraft({ ...p.plan, mode: draft.mode })}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        {draft.mode !== "stopwatch" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Num
              label={draft.mode === "countdown" ? "Minutes" : "Focus (min)"}
              value={draft.focusMin}
              min={1}
              max={600}
              onChange={(n) => set({ focusMin: n })}
            />
            {draft.mode !== "countdown" && (
              <>
                <Num
                  label="Break (min)"
                  value={draft.shortMin}
                  min={1}
                  max={120}
                  onChange={(n) => set({ shortMin: n })}
                />
                <Num
                  label="Long break (min)"
                  value={draft.longMin}
                  min={1}
                  max={180}
                  onChange={(n) => set({ longMin: n })}
                />
                <Num
                  label="Sessions before long"
                  value={draft.cycles}
                  min={1}
                  max={12}
                  onChange={(n) => set({ cycles: n })}
                />
              </>
            )}
          </div>
        )}

        {state.error && (
          <p role="alert" className="m-0 text-sm text-danger">
            {state.error}
          </p>
        )}
        <Button size="lg" onClick={begin}>
          Start
        </Button>
      </section>
    );
  }

  const running = isRunning(active);
  const isBreak = active.phase !== "focus";
  const planned = plannedMs(active);
  if (immersive) return <Immersive onExit={() => onImmersive(false)} />;
  return (
    <section aria-label="Timer" className="lv-card flex flex-col items-center gap-6 p-5">
      <div className="flex w-full items-center justify-between gap-3">
        <div>
          <p className="m-0 text-lg font-semibold">{phaseLabel(active)}</p>
          <p className="m-0 text-sm text-muted">
            {MODE_LABEL[active.plan.mode]}
            {active.plan.mode === "pomodoro" || active.plan.mode === "custom"
              ? ` · ${active.done} done`
              : ""}
            {!running && " · paused"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onImmersive(true)}>
          Full screen
        </Button>
      </div>

      <Face />

      <p role="status" className="sr-only">
        {phaseLabel(active)} {running ? "running" : "paused"}
      </p>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button size="lg" onClick={() => (running ? c.pause() : c.resume())}>
          {running ? "Pause" : "Resume"}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={() => c.reset()}>
            Reset
          </Button>
          <Button variant="secondary" size="sm" onClick={() => c.restart()}>
            Restart
          </Button>
          {isBreak ? (
            <Button variant="secondary" size="sm" onClick={() => c.skipBreak()}>
              Skip break
            </Button>
          ) : planned !== null ? (
            <Button variant="secondary" size="sm" onClick={() => c.nextSession()}>
              Next session
            </Button>
          ) : (
            <span />
          )}
          <Button variant="danger" size="sm" onClick={() => c.end()}>
            {active.plan.mode === "stopwatch" && !isBreak ? "Finish" : "End"}
          </Button>
        </div>
      </div>
    </section>
  );
}
