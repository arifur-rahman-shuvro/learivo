import { useEffect, useState } from "react";
import { notificationPermission, pushSupported, pushWasTurnedOn } from "../../../core/push.ts";
import { Button } from "../../../ui-kit/index.ts";
import { SupabasePushSettings, type PushSettingsRepo } from "../data/settingsRepo.ts";
import { realDevice, type DeviceApi } from "./NotificationsPanel.tsx";

const KEY = "learivo.pushInvite";
const QUIET_DAYS = 14;

function dismissedRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < QUIET_DAYS * 86400_000;
  } catch {
    return false;
  }
}

function remember() {
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* The invitation may show again, which is harmless. */
  }
}

/**
 * A gentle one-time invitation shown after a finished session, the moment the student has just
 * seen the value of practising. It never asks on load, and it stays away for two weeks after "Not now".
 */
export function PushInvite({
  userId,
  repo,
  device = realDevice,
  supported = pushSupported(),
  permission = notificationPermission(),
  alreadyOn = pushWasTurnedOn(),
}: {
  userId: string;
  repo?: PushSettingsRepo;
  device?: DeviceApi;
  supported?: boolean;
  permission?: NotificationPermission | "unsupported";
  alreadyOn?: boolean;
}) {
  const [hidden, setHidden] = useState(
    () => !supported || permission !== "default" || alreadyOn || dismissedRecently(),
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  useEffect(() => {
    if (hidden) return;
    // Stay quiet if this student already turned it on from another device.
    let alive = true;
    (repo ?? new SupabasePushSettings(userId)).load().then(
      (s) => alive && s.enabled && setHidden(true),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [hidden, repo, userId]);
  if (hidden) return null;

  const turnOn = async () => {
    setBusy(true);
    const r = await device.enable(userId);
    if (!r.ok) {
      setBusy(false);
      if (r.reason === "dismissed") {
        remember();
        setHidden(true);
      } else setNote(r.message);
      return;
    }
    const store = repo ?? new SupabasePushSettings(userId);
    const current = await store.load().catch(() => null);
    if (current) await store.save({ ...current, enabled: true }).catch(() => undefined);
    setBusy(false);
    setNote(
      "Done. Your Coach will message you at your study time. Change this any time in Settings.",
    );
    setHidden(false);
    window.setTimeout(() => setHidden(true), 6000);
  };

  return (
    <section aria-label="Notifications invitation" className="lv-card flex flex-col gap-2 p-4">
      <h3 className="m-0 text-base font-semibold">Want a nudge tomorrow?</h3>
      <p className="m-0 text-sm text-muted">
        Your Coach can remind you at a time you choose, protect your streak, and count down to your
        exam. Funny, warm or firm, your pick. Quiet at night, and you can switch it off any time.
      </p>
      {note ? (
        <p role="status" className="m-0 text-sm">
          {note}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void turnOn()} disabled={busy}>
            {busy ? "Turning on…" : "Turn on"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              remember();
              setHidden(true);
            }}
          >
            Not now
          </Button>
        </div>
      )}
    </section>
  );
}
