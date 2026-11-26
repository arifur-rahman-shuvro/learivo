import { config } from "./config.ts";
import { supabase } from "./supabase.ts";

/**
 * This device's side of push notifications: asking permission, subscribing the browser, and telling
 * the database about it. The Coach itself runs on the server (supabase/functions/push).
 */

const FLAG = "learivo.push";
const functionUrl = (route: string) => `${config.supabaseUrl}/functions/v1/push/${route}`;

/** Whether this browser can receive pushes at all. iPhone needs the app added to the Home Screen first. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return pushSupported() ? Notification.permission : "unsupported";
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(
    (s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"),
  );
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function flag(on?: boolean): boolean {
  try {
    if (on === true) window.localStorage.setItem(FLAG, "on");
    else if (on === false) window.localStorage.removeItem(FLAG);
    return window.localStorage.getItem(FLAG) === "on";
  } catch {
    return false;
  }
}

/** True once this device has been turned on, so the app only does push work for people who use it. */
export const pushWasTurnedOn = () => flag();

async function publicKey(): Promise<string> {
  const res = await fetch(functionUrl("key"), {
    headers: { apikey: config.supabasePublishableKey },
  });
  if (!res.ok) throw new Error("Notifications are not available right now. Try again later.");
  return ((await res.json()) as { publicKey: string }).publicKey;
}

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "dismissed" | "failed"; message: string };

/**
 * Asks permission (this must run from a tap), subscribes this browser and saves the device. The
 * settings row is switched on by the caller.
 */
export async function enablePush(userId: string): Promise<EnableResult> {
  if (!pushSupported()) {
    return {
      ok: false,
      reason: "unsupported",
      message:
        "This browser cannot show notifications. On iPhone, add Learivo to your Home Screen first.",
    };
  }
  const permission = await Notification.requestPermission();
  if (permission === "denied") {
    return {
      ok: false,
      reason: "denied",
      message:
        "Notifications are blocked for Learivo. Allow them in your browser's site settings, then try again.",
    };
  }
  if (permission !== "granted") {
    return {
      ok: false,
      reason: "dismissed",
      message: "No problem. You can turn them on later in Settings.",
    };
  }
  try {
    const key = await publicKey();
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    // A subscription made with another key would be rejected by the push service: start fresh.
    const current = sub?.options?.applicationServerKey;
    if (
      sub &&
      current &&
      btoa(String.fromCharCode(...new Uint8Array(current))) !==
        btoa(String.fromCharCode(...b64urlToBytes(key)))
    ) {
      await sub.unsubscribe();
      sub = null;
    }
    sub ??= await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlToBytes(key),
    });
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
      throw new Error("The browser gave no keys.");
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 300),
        failures: 0,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) throw new Error(error.message);
    flag(true);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: "failed",
      message: e instanceof Error ? e.message : "Could not turn notifications on.",
    };
  }
}

/** Removes this device from the database and from the browser's push service. */
export async function removeThisDevice(userId: string): Promise<void> {
  try {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch {
    /* Best effort: a device that cannot be reached is cleaned up by the server later. */
  } finally {
    flag(false);
  }
}

/** Same, for whoever is signed in right now (used when signing out). Does nothing if push was never turned on here. */
export async function removeThisDeviceForCurrentUser(): Promise<void> {
  if (!flag()) return;
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) await removeThisDevice(data.user.id);
  } catch {
    flag(false);
  }
}

/** Is this very device subscribed (not just another phone of the same student)? */
export async function thisDeviceSubscribed(): Promise<boolean> {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export type TestResult = { ok: true } | { ok: false; message: string };

/** Asks the server to send a test notification to the signed-in student's devices. */
export async function sendTestPush(): Promise<TestResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: "Sign in again, then try the test." };
  try {
    const res = await fetch(functionUrl("test"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: config.supabasePublishableKey },
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, message: body?.error ?? "The test could not be sent." };
  } catch {
    return { ok: false, message: "No connection. Try again when you are online." };
  }
}

/** The student tapped a notification: remember it, so the Coach knows messages are welcome. */
export async function markNotificationOpened(id: string | null): Promise<void> {
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return;
  try {
    await supabase
      .from("push_log")
      .update({ clicked_at: new Date().toISOString(), action: "open" })
      .eq("id", id)
      .is("clicked_at", null);
  } catch {
    /* Nothing depends on it. */
  }
}

/** Opening the app by hand also counts as seeing what was sent lately. */
export async function markRecentSeen(): Promise<void> {
  if (!pushWasTurnedOn()) return;
  try {
    await supabase
      .from("push_log")
      .update({ clicked_at: new Date().toISOString(), action: "seen" })
      .is("clicked_at", null)
      .gt("sent_at", new Date(Date.now() - 2 * 86400_000).toISOString());
  } catch {
    /* Nothing depends on it. */
  }
}
