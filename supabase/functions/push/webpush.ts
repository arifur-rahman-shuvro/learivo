/**
 * Web Push for Learivo, written on the standard WebCrypto API so it runs unchanged in the Edge
 * Function (Deno) and in the tests (Node). It follows:
 *   RFC 8291  message encryption (aes128gcm)
 *   RFC 8292  VAPID: the sender proves who it is with a signed token
 *   RFC 8030  the HTTP request to the browser's push service
 * The encryption is checked against the RFC 8291 test vector in the tests.
 */

type Bytes = Uint8Array<ArrayBuffer>;

const enc = new TextEncoder();

export function b64urlToBytes(s: string): Bytes {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(b: Bytes): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** A browser's push subscription, as stored: its address and the two keys it gave us. */
export interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** For tests only: fixed sender key and salt, so the RFC example can be reproduced. */
export interface EncryptFixed {
  senderPrivateJwk?: JsonWebKey;
  senderPublic?: Bytes;
  salt?: Bytes;
}

/** Encrypts a message for one subscription. Returns the HTTP body (RFC 8188 header + record). */
export async function encryptPayload(
  plaintext: Bytes,
  sub: Pick<Subscription, "p256dh" | "auth">,
  fixed: EncryptFixed = {},
): Promise<Bytes> {
  const uaPublic = b64urlToBytes(sub.p256dh);
  const authSecret = b64urlToBytes(sub.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("Bad subscription key");
  if (authSecret.length < 16) throw new Error("Bad subscription auth secret");
  if (plaintext.length > 3993) throw new Error("Message too long for one push");

  let senderPrivate: CryptoKey;
  let senderPublic: Bytes;
  if (fixed.senderPrivateJwk && fixed.senderPublic) {
    senderPrivate = await crypto.subtle.importKey(
      "jwk",
      fixed.senderPrivateJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
    senderPublic = fixed.senderPublic;
  } else {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    senderPrivate = pair.privateKey;
    senderPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }
  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, senderPrivate, 256),
  );

  const salt = fixed.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, senderPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // One record: the message, then 0x02 (the last-record marker).
  const record = concat(plaintext, new Uint8Array([2]));
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, record),
  );

  const header = new Uint8Array(16 + 4 + 1 + senderPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = senderPublic.length;
  header.set(senderPublic, 21);
  return concat(header, sealed);
}

/** The sender's own signing key (VAPID). Made once and kept on the server. */
export interface VapidKeys {
  /** Private key as JWK (ES256). Never leaves the server. */
  privateJwk: JsonWebKey;
  /** Public key, 65 bytes, base64url. Browsers need this to subscribe. */
  publicKey: string;
}

export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { privateJwk, publicKey: bytesToB64url(raw) };
}

/** The Authorization header for one push service (RFC 8292). Valid for 12 hours. */
export async function vapidHeader(
  endpoint: string,
  keys: VapidKeys,
  subject: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const head = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = bytesToB64url(
    enc.encode(JSON.stringify({ aud, exp: nowSeconds + 12 * 3600, sub: subject })),
  );
  const key = await crypto.subtle.importKey(
    "jwk",
    keys.privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      enc.encode(`${head}.${body}`),
    ),
  );
  return `vapid t=${head}.${body}.${bytesToB64url(sig)}, k=${keys.publicKey}`;
}

export type PushResult =
  | { ok: true; status: number }
  /** gone: the browser says this subscription no longer exists, so it should be deleted. */
  | { ok: false; gone: boolean; status: number; retry: boolean };

export interface SendOptions {
  /** Seconds the push service may hold the message while the phone is off. */
  ttl?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** A newer message with the same topic replaces an older one that was not delivered yet. */
  topic?: string;
  fetchImpl?: typeof fetch;
}

/** Encrypts and sends one message. Never throws for HTTP failures: it reports them. */
export async function sendPush(
  sub: Subscription,
  message: unknown,
  keys: VapidKeys,
  subject: string,
  opts: SendOptions = {},
): Promise<PushResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub);
  const headers: Record<string, string> = {
    Authorization: await vapidHeader(sub.endpoint, keys, subject),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(opts.ttl ?? 6 * 3600),
    Urgency: opts.urgency ?? "normal",
  };
  if (opts.topic) headers.Topic = opts.topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(sub.endpoint, { method: "POST", headers, body });
  } catch {
    return { ok: false, gone: false, status: 0, retry: true };
  }
  if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
  return {
    ok: false,
    gone: res.status === 404 || res.status === 410,
    status: res.status,
    retry: res.status === 429 || res.status >= 500,
  };
}
