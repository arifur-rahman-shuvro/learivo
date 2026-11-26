/**
 * Learivo Coach: the push notification server (Supabase Edge Function).
 *
 * Routes (the last part of the URL):
 *   GET  key   the public key a browser needs to subscribe (no secret in it)
 *   POST tick  called by the schedule every 10 minutes; decides and sends for every student
 *   POST test  a signed-in student sends a test notification to their own devices
 *   POST act   the notification's own buttons (snooze one hour, quiet for today); each link is signed
 *
 * The signing key for VAPID is created here on first use and kept in a table no browser can read.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { decide, tokensFor, parseLocal, type Facts } from "./coach.ts";
import { compose, type Tone } from "./messages.ts";
import {
  bytesToB64url,
  generateVapidKeys,
  sendPush,
  type Subscription,
  type VapidKeys,
} from "./webpush.ts";

const SUBJECT = "mailto:learivo.official@gmail.com";
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL_BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-push-secret, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function secret(name: string): Promise<string | null> {
  const { data } = await db.rpc("push_secret", { p_name: name });
  return (data as string | null) ?? null;
}

let cachedKeys: VapidKeys | undefined;
async function vapid(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys;
  const stored = await secret("vapid");
  if (stored) return (cachedKeys = JSON.parse(stored));
  const made = await generateVapidKeys();
  // If two requests race, the database keeps the first one and both read it back.
  const { data } = await db.rpc("push_secret_init", {
    p_name: "vapid",
    p_candidate: JSON.stringify(made),
  });
  return (cachedKeys = JSON.parse(data as string));
}

const enc = new TextEncoder();
async function hmac(message: string): Promise<string> {
  const { data } = await db.rpc("push_secret_init", {
    p_name: "act",
    p_candidate: bytesToB64url(crypto.getRandomValues(new Uint8Array(32))),
  });
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(data as string),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToB64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message))));
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface Row {
  [k: string]: unknown;
}
const camel = (s: string) => s.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
function toFacts(r: Row): Facts {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) o[camel(k)] = v;
  o.displayName = (o.displayName as string | null) ?? "";
  o.examTitle = (o.examTitle as string | null) ?? "";
  o.sentKindsToday = o.sentKindsToday ?? [];
  return o as unknown as Facts;
}

/** Sends to every device of one student. Returns how many devices accepted it. */
async function deliver(
  userId: string,
  payload: Record<string, unknown>,
  opts: { urgency?: "low" | "normal" | "high"; topic?: string; ttl?: number } = {},
): Promise<number> {
  const keys = await vapid();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failures")
    .eq("user_id", userId)
    .lt("failures", 5);
  let ok = 0;
  for (const s of (subs ?? []) as (Subscription & { id: string; failures: number })[]) {
    const res = await sendPush(s, payload, keys, SUBJECT, opts);
    if (res.ok) {
      ok++;
      if (s.failures > 0)
        await db
          .from("push_subscriptions")
          .update({ failures: 0, last_seen_at: new Date().toISOString() })
          .eq("id", s.id);
    } else if (res.gone) {
      await db.from("push_subscriptions").delete().eq("id", s.id);
    } else {
      await db
        .from("push_subscriptions")
        .update({ failures: s.failures + 1 })
        .eq("id", s.id);
    }
  }
  return ok;
}

async function tick(): Promise<Response> {
  const now = new Date();
  const { data, error } = await db.rpc("push_facts", { p_now: now.toISOString() });
  if (error) return json({ error: error.message }, 500);
  const summary = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  for (const row of (data ?? []) as Row[]) {
    summary.checked++;
    const f = toFacts(row);
    const d = decide(f, now);
    if (!d) {
      summary.skipped++;
      continue;
    }
    // Write the log first, so the daily cap holds even if two runs overlap.
    const { data: log, error: logError } = await db
      .from("push_log")
      .insert({ user_id: f.userId, kind: d.kind, title: d.title, body: d.body })
      .select("id")
      .single();
    if (logError || !log) {
      summary.failed++;
      continue;
    }
    const id = (log as { id: string }).id;
    const sig = await hmac(id);
    const sent = await deliver(
      f.userId,
      {
        title: d.title,
        body: d.body,
        kind: d.kind,
        tag: d.tag,
        go: d.go,
        id,
        buttons: d.buttons,
        act: `${URL_BASE}/functions/v1/push/act?n=${id}&s=${sig}`,
      },
      { topic: d.kind, urgency: d.kind === "streak" ? "high" : "normal" },
    );
    if (sent > 0) summary.sent++;
    else {
      summary.failed++;
      await db.from("push_log").delete().eq("id", id);
    }
  }
  return json(summary);
}

async function userFrom(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  return data.user?.id ?? null;
}

async function test(req: Request): Promise<Response> {
  const userId = await userFrom(req);
  if (!userId) return json({ error: "Sign in first." }, 401);
  const { data: s } = await db
    .from("push_settings")
    .select("tone")
    .eq("user_id", userId)
    .maybeSingle();
  const tone = ((s as { tone?: Tone } | null)?.tone ?? "mix") as Tone;
  const tokens = tokensFor(
    {
      displayName: "",
      examTitle: "",
      dailyGoal: 20,
      answeredToday: 0,
      streak: 0,
      dueCards: 0,
      examDate: null,
      weakSubject: null,
      weakPercent: null,
      weekAnswered: 0,
      weekPercent: null,
      prevWeekPercent: null,
      daysAway: 0,
    } as unknown as Facts,
    parseLocal("2026-01-01T12:00:00"),
  );
  const words = compose("test", tone, tokens, userId, Math.floor(Date.now() / 86400000));
  const sent = await deliver(
    userId,
    {
      title: words.title,
      body: words.body,
      kind: "test",
      tag: "test",
      go: "quick",
      id: null,
      buttons: [],
    },
    { urgency: "high", ttl: 600 },
  );
  return sent > 0
    ? json({ sent })
    : json(
        {
          error:
            "No device accepted it. Open Settings > Notifications and turn it on again on this device.",
        },
        404,
      );
}

/** Seconds until the student's next local midnight. */
function untilMidnight(tz: string, now: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return 86400 - (g("hour") * 3600 + g("minute") * 60 + g("second"));
  } catch {
    return 8 * 3600;
  }
}

async function act(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const id = q.get("n") ?? "";
  const sig = q.get("s") ?? "";
  const what = q.get("do") === "today" ? "today" : "later";
  if (!/^[0-9a-f-]{36}$/.test(id) || !same(sig, await hmac(id)))
    return json({ error: "Bad link" }, 403);
  const { data: log } = await db.from("push_log").select("user_id").eq("id", id).maybeSingle();
  const userId = (log as { user_id: string } | null)?.user_id;
  if (!userId) return json({ error: "Not found" }, 404);
  const now = new Date();
  let seconds = 3600;
  if (what === "today") {
    const { data: p } = await db
      .from("profiles")
      .select("time_zone")
      .eq("id", userId)
      .maybeSingle();
    seconds = untilMidnight((p as { time_zone?: string } | null)?.time_zone || "UTC", now);
  }
  await db
    .from("push_settings")
    .update({ snooze_until: new Date(now.getTime() + seconds * 1000).toISOString() })
    .eq("user_id", userId);
  await db
    .from("push_log")
    .update({ clicked_at: now.toISOString(), action: what })
    .eq("id", id)
    .is("clicked_at", null);
  return json({ ok: true, until: seconds });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const route = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  try {
    if (route === "key" && req.method === "GET")
      return json({ publicKey: (await vapid()).publicKey });
    if (route === "tick" && req.method === "POST") {
      const expected = await secret("cron");
      if (!expected || !same(req.headers.get("x-push-secret") ?? "", expected))
        return json({ error: "Not allowed" }, 403);
      return await tick();
    }
    if (route === "test" && req.method === "POST") return await test(req);
    if (route === "act" && (req.method === "POST" || req.method === "GET")) return await act(req);
    return json({ error: "Unknown route" }, 404);
  } catch (e) {
    console.error("push failed", e);
    return json({ error: "Something went wrong." }, 500);
  }
});
