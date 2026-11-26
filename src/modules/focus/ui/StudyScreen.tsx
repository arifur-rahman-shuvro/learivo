import { useEffect, useState } from "react";
import { Button, Segmented, SettingsIcon } from "../../../ui-kit/index.ts";
import { duration, isRunning } from "../domain/engine.ts";
import { totals } from "../domain/stats.ts";
import { Dashboard } from "./Dashboard.tsx";
import { FocusSettingsDialog } from "./FocusSettingsDialog.tsx";
import { useFocus } from "./FocusProvider.tsx";
import { History } from "./History.tsx";
import { TimerCard } from "./TimerCard.tsx";

type Tab = "timer" | "stats" | "history";

/** Study: the focus timer, the study-time dashboard and the session history. */
export default function StudyScreen() {
  const { controller: c, state } = useFocus();
  const [tab, setTab] = useState<Tab>("timer");
  const [settings, setSettings] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const active = state.active;

  // Full screen: the browser's own where it exists, with the page-level overlay as the fallback.
  const goImmersive = (on: boolean) => {
    setImmersive(on);
    try {
      if (on) void document.documentElement.requestFullscreen?.().catch(() => undefined);
      else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } catch {
      /* the overlay alone is enough */
    }
  };
  useEffect(() => {
    const out = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    document.addEventListener("fullscreenchange", out);
    return () => document.removeEventListener("fullscreenchange", out);
  }, []);
  useEffect(() => {
    if (!active) setImmersive(false);
  }, [active]);

  // Keyboard: Space start/pause/resume, R reset, S skip, F full screen, Escape leaves full screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName)))
        return;
      const k = e.key.toLowerCase();
      if (k === " ") {
        e.preventDefault();
        if (!active) c.begin();
        else if (isRunning(active)) c.pause();
        else c.resume();
      } else if (!active) return;
      else if (k === "r") c.reset();
      else if (k === "s") {
        if (active.phase === "focus") c.nextSession();
        else c.skipBreak();
      } else if (k === "f") goImmersive(!immersive);
      else if (k === "escape" && immersive) goImmersive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const today = totals(state.records, new Date()).today;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="module-title" className="m-0 text-3xl font-bold">
            Study
          </h1>
          <p className="m-0 text-sm text-muted">
            {today > 0 ? `${duration(today)} focused today.` : "Nothing focused yet today."}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<SettingsIcon size={18} />}
          onClick={() => setSettings(true)}
        >
          Timer settings
        </Button>
      </header>

      {state.recovery && active && (
        <section
          role="alert"
          aria-label="Recovered session"
          className="lv-card flex flex-col gap-3 border-accent p-5"
        >
          <p className="m-0 font-semibold">Your session was still running</p>
          <p className="m-0 text-sm text-muted">
            Learivo was closed for a while. Keep counting from the original start, or stop at{" "}
            {new Date(state.recovery.seenAt).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
              hour12: state.settings.hour12,
            })}{" "}
            when you were last here.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => c.keepRunning()}>Keep counting</Button>
            <Button variant="secondary" onClick={() => c.stopAtLastSeen()}>
              Stop at last seen
            </Button>
          </div>
        </section>
      )}

      {state.waiting > 0 && (
        <p role="status" className="m-0 text-sm text-muted">
          {state.waiting} session{state.waiting === 1 ? "" : "s"} saved on this device, waiting for
          a connection.
        </p>
      )}

      <Segmented
        label="Study view"
        hideLabel
        value={tab}
        options={[
          { value: "timer", label: "Timer" },
          { value: "stats", label: "Stats" },
          { value: "history", label: "History" },
        ]}
        onChange={(v) => setTab(v as Tab)}
      />

      {tab === "timer" && <TimerCard immersive={immersive} onImmersive={goImmersive} />}
      {tab === "stats" && <Dashboard />}
      {tab === "history" && <History />}

      <FocusSettingsDialog open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
