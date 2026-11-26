import { useCallback, useEffect, useState } from "react";
import {
  enablePush,
  notificationPermission,
  pushSupported,
  removeThisDevice,
  sendTestPush,
  thisDeviceSubscribed,
  type EnableResult,
  type TestResult,
} from "../../../core/push.ts";
import { Button, Field, Segmented, Spinner } from "../../../ui-kit/index.ts";
import {
  DEFAULT_SETTINGS,
  KINDS,
  MAX_PER_DAY_CHOICES,
  TONES,
  hourLabel,
  hourToTime,
  previewFor,
  studyTimeIsQuiet,
  usualHour,
  type PushSettings,
  type Tone,
} from "../domain/settings.ts";
import { SupabasePushSettings, type PushSettingsRepo } from "../data/settingsRepo.ts";

/** What this device can do, so the panel can be tested without a real browser. */
export interface DeviceApi {
  supported(): boolean;
  permission(): NotificationPermission | "unsupported";
  subscribed(): Promise<boolean>;
  enable(userId: string): Promise<EnableResult>;
  remove(userId: string): Promise<void>;
  test(): Promise<TestResult>;
}

export const realDevice: DeviceApi = {
  supported: pushSupported,
  permission: notificationPermission,
  subscribed: thisDeviceSubscribed,
  enable: enablePush,
  remove: removeThisDevice,
  test: sendTestPush,
};

/** Settings > Notifications: turn the Coach on, choose its voice, hours and topics, and send a test. */
export function NotificationsPanel({
  userId,
  repo,
  device = realDevice,
}: {
  userId: string;
  repo?: PushSettingsRepo;
  device?: DeviceApi;
}) {
  const [store] = useState<PushSettingsRepo>(() => repo ?? new SupabasePushSettings(userId));
  const [s, setS] = useState<PushSettings | null>(null);
  const [here, setHere] = useState(false);
  const [usual, setUsual] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState<null | "enable" | "test">(null);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    let alive = true;
    Promise.all([
      store.load(),
      device.subscribed(),
      store.recentStarts().catch(() => [] as string[]),
    ]).then(
      ([settings, subscribed, starts]) => {
        if (!alive) return;
        setS(settings);
        setHere(subscribed);
        setUsual(usualHour(starts));
      },
      (e) =>
        alive && setLoadError(e instanceof Error ? e.message : "Could not load your settings."),
    );
    return () => {
      alive = false;
    };
  }, [store, device]);

  const update = useCallback(
    async (patch: Partial<PushSettings>) => {
      if (!s) return;
      const next = { ...s, ...patch };
      setS(next);
      try {
        await store.save(next);
        setMessage(null);
      } catch (e) {
        setS(s);
        setMessage({ text: e instanceof Error ? e.message : "Could not save.", bad: true });
      }
    },
    [s, store],
  );

  if (loadError)
    return (
      <p role="alert" className="m-0 text-sm text-danger">
        {loadError}
      </p>
    );
  if (!s)
    return (
      <div role="status" aria-label="Loading notification settings">
        <Spinner />
      </div>
    );

  const permission = device.permission();
  const supported = device.supported();

  const turnOn = async () => {
    setBusy("enable");
    setMessage(null);
    const r = await device.enable(userId);
    setBusy(null);
    if (!r.ok) {
      setMessage({
        text: r.message,
        bad: r.reason === "failed" || r.reason === "denied" || r.reason === "unsupported",
      });
      return;
    }
    setHere(true);
    await update({ enabled: true });
    setMessage({
      text: "Notifications are on. Send yourself a test to see how they look.",
      bad: false,
    });
  };

  const turnOff = async () => {
    await update({ enabled: false });
    await device.remove(userId);
    setHere(false);
    setMessage({ text: "Notifications are off on this device.", bad: false });
  };

  const test = async () => {
    setBusy("test");
    setMessage(null);
    const r = await device.test();
    setBusy(null);
    setMessage(
      r.ok
        ? { text: "Sent. It should appear in a few seconds.", bad: false }
        : { text: r.message, bad: true },
    );
  };

  const preview = previewFor(s.tone, 0);
  const needsThisDevice = s.enabled && !here;

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        Your Coach sends short messages built from your real numbers: your streak, revision that is
        due, your exam date and your weakest subject. Never when you are asleep, and never more than
        you choose.
      </p>

      {!supported && (
        <p role="note" className="m-0 text-sm">
          This browser cannot show notifications. On an iPhone, add Learivo to your Home Screen
          first, then open it from there.
        </p>
      )}
      {supported && permission === "denied" && (
        <p role="note" className="m-0 text-sm">
          Notifications are blocked for Learivo. In your browser, open the site settings (the icon
          next to the address), allow Notifications, then come back here.
        </p>
      )}

      {supported && (!s.enabled || needsThisDevice) && (
        <div>
          <Button onClick={() => void turnOn()} disabled={busy !== null || permission === "denied"}>
            {busy === "enable"
              ? "Turning on…"
              : needsThisDevice
                ? "Turn on for this device"
                : "Turn on notifications"}
          </Button>
        </div>
      )}

      {s.enabled && here && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void test()}
              disabled={busy !== null}
            >
              {busy === "test" ? "Sending…" : "Send me a test"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void turnOff()}>
              Turn off
            </Button>
          </div>

          <section className="flex flex-col gap-2" aria-label="Voice">
            <Segmented
              label="Voice"
              value={s.tone}
              options={TONES.map((t) => ({ value: t.value, label: t.label }))}
              onChange={(v) => void update({ tone: v as Tone })}
            />
            <p className="m-0 text-xs text-muted">{TONES.find((t) => t.value === s.tone)?.hint}</p>
            <div className="lv-card flex flex-col gap-0.5 p-3" aria-label="Example notification">
              <span className="text-xs text-muted">Example</span>
              <span className="text-sm font-semibold">{preview.title}</span>
              <span className="text-sm">{preview.body}</span>
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-label="Times">
            <Field
              label="Study time"
              type="time"
              value={s.studyTime}
              onChange={(e) => e.target.value && void update({ studyTime: e.target.value })}
              hint="The daily reminder comes within 3 hours after this."
            />
            {usual !== null && hourToTime(usual) !== s.studyTime && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>You usually study around {hourLabel(usual)}.</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void update({ studyTime: hourToTime(usual) })}
                >
                  Use {hourLabel(usual)}
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Quiet from"
                type="time"
                value={s.quietStart}
                onChange={(e) => e.target.value && void update({ quietStart: e.target.value })}
              />
              <Field
                label="Quiet until"
                type="time"
                value={s.quietEnd}
                onChange={(e) => e.target.value && void update({ quietEnd: e.target.value })}
              />
            </div>
            {studyTimeIsQuiet(s) && (
              <p role="alert" className="m-0 text-sm font-medium text-danger">
                Your study time falls inside quiet hours, so the daily reminder will not be sent.
              </p>
            )}
            <Segmented
              label="Most per day"
              value={String(s.maxPerDay)}
              options={MAX_PER_DAY_CHOICES.map((n) => ({ value: String(n), label: String(n) }))}
              onChange={(v) => void update({ maxPerDay: Number(v) })}
            />
          </section>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-semibold">What to send</legend>
            {KINDS.map((k) => (
              <label key={k.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={s.kinds[k.id] !== false}
                  onChange={(e) => {
                    const kinds = { ...s.kinds };
                    if (e.target.checked) delete kinds[k.id];
                    else kinds[k.id] = false;
                    void update({ kinds });
                  }}
                />
                <span>
                  {k.label}
                  <span className="block text-muted">{k.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </>
      )}

      {message && (
        <p
          role={message.bad ? "alert" : "status"}
          className={`m-0 text-sm ${message.bad ? "font-medium text-danger" : ""}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

export { DEFAULT_SETTINGS };
