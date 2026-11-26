import { useState } from "react";
import { Button, Dialog, Segmented, ThemeSwitcher } from "../../../ui-kit/index.ts";
import { MAX_PRESETS, MODE_LABEL, type FocusSettings } from "../domain/settings.ts";
import type { TimerMode, TimerPlan } from "../domain/engine.ts";
import { Num } from "./Num.tsx";
import { useFocus } from "./FocusProvider.tsx";

const MODES: TimerMode[] = ["pomodoro", "stopwatch", "countdown", "custom"];

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {hint && <span className="block text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function FocusSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { controller, state } = useFocus();
  const s = state.settings;
  const [name, setName] = useState("");
  const save = (patch: Partial<FocusSettings>) => void controller.saveSettings({ ...s, ...patch });
  const plan = (patch: Partial<TimerPlan>) => save({ plan: { ...s.plan, ...patch } });
  const canAsk = typeof Notification !== "undefined" && Notification.permission === "default";
  const denied = typeof Notification !== "undefined" && Notification.permission === "denied";

  return (
    <Dialog
      open={open}
      title="Timer settings"
      onClose={onClose}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="flex flex-col gap-6">
        <section aria-label="Default timer" className="flex flex-col gap-3">
          <h3 className="m-0 text-base font-semibold">Default timer</h3>
          <Segmented
            label="Default mode"
            value={s.plan.mode}
            options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
            onChange={(v) => plan({ mode: v as TimerMode })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Num
              label="Focus (min)"
              value={s.plan.focusMin}
              min={1}
              max={600}
              onChange={(n) => plan({ focusMin: n })}
            />
            <Num
              label="Break (min)"
              value={s.plan.shortMin}
              min={1}
              max={120}
              onChange={(n) => plan({ shortMin: n })}
            />
            <Num
              label="Long break (min)"
              value={s.plan.longMin}
              min={1}
              max={180}
              onChange={(n) => plan({ longMin: n })}
            />
            <Num
              label="Sessions before long break"
              value={s.plan.cycles}
              min={1}
              max={12}
              onChange={(n) => plan({ cycles: n })}
            />
          </div>
          <Check
            label="Start the break by itself"
            checked={s.plan.autoBreak}
            onChange={(v) => plan({ autoBreak: v })}
          />
          <Check
            label="Start the next focus by itself"
            hint="Off by default, so a break never runs into the next session without you."
            checked={s.plan.autoFocus}
            onChange={(v) => plan({ autoFocus: v })}
          />
        </section>

        <section aria-label="Presets" className="flex flex-col gap-3">
          <h3 className="m-0 text-base font-semibold">My presets</h3>
          {s.presets.length === 0 && (
            <p className="m-0 text-sm text-muted">
              Save the current default as a preset to pick it with one tap.
            </p>
          )}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {s.presets.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <strong>{p.name}</strong> · {p.plan.focusMin}/{p.plan.shortMin} min
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete preset ${p.name}`}
                  onClick={() => save({ presets: s.presets.filter((x) => x.id !== p.id) })}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
          {s.presets.length < MAX_PRESETS && (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = name.trim();
                if (!n) return;
                save({
                  presets: [
                    ...s.presets,
                    { id: `p-${Date.now().toString(36)}`, name: n.slice(0, 30), plan: s.plan },
                  ],
                });
                setName("");
              }}
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="preset-name" className="text-sm font-semibold">
                  Preset name
                </label>
                <input
                  id="preset-name"
                  className="lv-input"
                  maxLength={30}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={!name.trim()}>
                Save preset
              </Button>
            </form>
          )}
        </section>

        <section aria-label="Display" className="flex flex-col gap-3">
          <h3 className="m-0 text-base font-semibold">Display</h3>
          <Segmented
            label="Timer style"
            value={s.display}
            options={[
              { value: "ring", label: "Ring and digits" },
              { value: "digits", label: "Digits only" },
            ]}
            onChange={(v) => save({ display: v as FocusSettings["display"] })}
          />
          <Segmented
            label="Clock"
            value={s.hour12 ? "12" : "24"}
            options={[
              { value: "12", label: "12-hour" },
              { value: "24", label: "24-hour" },
            ]}
            onChange={(v) => save({ hour12: v === "12" })}
          />
          <Check
            label="Show a progress bar"
            checked={s.showProgressBar}
            onChange={(v) => save({ showProgressBar: v })}
          />
          <Check
            label="Keep the screen on during focus"
            hint="Where your browser allows it."
            checked={s.keepAwake}
            onChange={(v) => save({ keepAwake: v })}
          />
          <ThemeSwitcher />
        </section>

        <section aria-label="Alerts" className="flex flex-col gap-3">
          <h3 className="m-0 text-base font-semibold">When a session ends</h3>
          <Check
            label="Vibrate"
            hint="On phones that support it."
            checked={s.vibrate}
            onChange={(v) => save({ vibrate: v })}
          />
          <Check
            label="Show a notification when Learivo is in the background"
            checked={s.notify}
            onChange={(v) => save({ notify: v })}
          />
          {s.notify && canAsk && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void Notification.requestPermission().then(() => controller.saveSettings(s))
              }
            >
              Allow notifications
            </Button>
          )}
          {s.notify && denied && (
            <p className="m-0 text-sm text-muted">
              Notifications are blocked for this site. Allow them in your browser's site settings.
            </p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
