// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  b64urlToBytes,
  bytesToB64url,
  encryptPayload,
  generateVapidKeys,
  sendPush,
  vapidHeader,
} from "../../../../supabase/functions/push/webpush.ts";

// RFC 8291 section 5 and appendix A.
const AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
const AS_PUBLIC =
  "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const UA_PRIVATE = "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94";
const UA_PUBLIC =
  "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
const SALT = "DGv6ra1nlYgDCS1FRnbzlw";
const EXPECTED =
  "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

/** A P-256 private scalar d and public point as a JWK. */
function jwkFor(d: string, pub: string): JsonWebKey {
  const raw = b64urlToBytes(pub);
  return {
    kty: "EC",
    crv: "P-256",
    d,
    x: bytesToB64url(raw.slice(1, 33)),
    y: bytesToB64url(raw.slice(33, 65)),
  };
}

async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: string,
  len: number,
) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: new TextEncoder().encode(info) },
      k,
      len * 8,
    ),
  );
}

/** What a phone does: read the header, derive the keys with its private key, and open the record. */
async function decrypt(
  body: Uint8Array<ArrayBuffer>,
  uaPrivateJwk: JsonWebKey,
  uaPublic: string,
  auth: string,
) {
  const salt = body.slice(0, 16);
  const idlen = body[20]!;
  const asPublic = body.slice(21, 21 + idlen);
  const sealed = body.slice(21 + idlen);
  const priv = await crypto.subtle.importKey(
    "jwk",
    uaPrivateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const asKey = await crypto.subtle.importKey(
    "raw",
    asPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, priv, 256),
  );
  const info = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...b64urlToBytes(uaPublic),
    ...asPublic,
  ]);
  const k = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveBits"]);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: b64urlToBytes(auth), info },
      k,
      256,
    ),
  );
  const cek = await hkdf(salt, ikm, "Content-Encoding: aes128gcm\0", 16);
  const nonce = await hkdf(salt, ikm, "Content-Encoding: nonce\0", 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, sealed),
  );
  return plain.slice(0, plain.lastIndexOf(2));
}

describe("Web Push encryption", () => {
  it("matches the RFC 8291 test vector byte for byte", async () => {
    const body = await encryptPayload(
      new TextEncoder().encode("When I grow up, I want to be a watermelon"),
      { p256dh: UA_PUBLIC, auth: AUTH },
      {
        senderPrivateJwk: jwkFor(AS_PRIVATE, AS_PUBLIC),
        senderPublic: b64urlToBytes(AS_PUBLIC),
        salt: b64urlToBytes(SALT),
      },
    );
    expect(bytesToB64url(body)).toBe(EXPECTED);
  });

  it("can be opened by the phone's private key (random sender key and salt)", async () => {
    const message = JSON.stringify({ title: "Day 6 streak", body: "One question saves it. 🔥" });
    const body = await encryptPayload(new TextEncoder().encode(message), {
      p256dh: UA_PUBLIC,
      auth: AUTH,
    });
    const plain = await decrypt(body, jwkFor(UA_PRIVATE, UA_PUBLIC), UA_PUBLIC, AUTH);
    expect(new TextDecoder().decode(plain)).toBe(message);
  });

  it("uses a new key and salt every time", async () => {
    const a = await encryptPayload(new TextEncoder().encode("x"), {
      p256dh: UA_PUBLIC,
      auth: AUTH,
    });
    const b = await encryptPayload(new TextEncoder().encode("x"), {
      p256dh: UA_PUBLIC,
      auth: AUTH,
    });
    expect(bytesToB64url(a)).not.toBe(bytesToB64url(b));
  });

  it("refuses a bad key and a message that is too long", async () => {
    await expect(encryptPayload(new Uint8Array(3), { p256dh: "AAAA", auth: AUTH })).rejects.toThrow(
      /key/,
    );
    await expect(
      encryptPayload(new Uint8Array(4000), { p256dh: UA_PUBLIC, auth: AUTH }),
    ).rejects.toThrow(/long/);
  });
});

describe("VAPID", () => {
  it("signs a token the public key can verify, for the push service's own address", async () => {
    const keys = await generateVapidKeys();
    expect(b64urlToBytes(keys.publicKey)).toHaveLength(65);
    const header = await vapidHeader(
      "https://fcm.example.test/send/abc",
      keys,
      "mailto:a@b.test",
      1000,
    );
    const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header)!;
    expect(m).toBeTruthy();
    expect(m[4]).toBe(keys.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(m[2]!)));
    expect(claims).toEqual({
      aud: "https://fcm.example.test",
      exp: 1000 + 43200,
      sub: "mailto:a@b.test",
    });
    const pub = await crypto.subtle.importKey(
      "raw",
      b64urlToBytes(keys.publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      b64urlToBytes(m[3]!),
      new TextEncoder().encode(`${m[1]}.${m[2]}`),
    );
    expect(ok).toBe(true);
  });
});

describe("sending", () => {
  const sub = { endpoint: "https://push.example.test/x", p256dh: UA_PUBLIC, auth: AUTH };
  const reply = (status: number) => (async () => new Response(null, { status })) as typeof fetch;

  it("posts an encrypted body with the right headers", async () => {
    const keys = await generateVapidKeys();
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    const r = await sendPush(sub, { title: "t" }, keys, "mailto:a@b.test", {
      fetchImpl,
      topic: "daily nudge!",
      urgency: "low",
      ttl: 60,
    });
    expect(r).toEqual({ ok: true, status: 201 });
    const h = seen!.init.headers as Record<string, string>;
    expect(seen!.url).toBe(sub.endpoint);
    expect(h["Content-Encoding"]).toBe("aes128gcm");
    expect(h.TTL).toBe("60");
    expect(h.Urgency).toBe("low");
    expect(h.Topic).toBe("dailynudge");
    expect(h.Authorization).toMatch(/^vapid t=/);
  });

  it("reports a gone subscription so it can be deleted, and flags retryable failures", async () => {
    const keys = await generateVapidKeys();
    expect(
      await sendPush(sub, {}, keys, "mailto:a@b.test", { fetchImpl: reply(410) }),
    ).toMatchObject({
      ok: false,
      gone: true,
    });
    expect(
      await sendPush(sub, {}, keys, "mailto:a@b.test", { fetchImpl: reply(404) }),
    ).toMatchObject({
      gone: true,
    });
    expect(
      await sendPush(sub, {}, keys, "mailto:a@b.test", { fetchImpl: reply(503) }),
    ).toMatchObject({
      gone: false,
      retry: true,
    });
    expect(
      await sendPush(sub, {}, keys, "mailto:a@b.test", { fetchImpl: reply(400) }),
    ).toMatchObject({
      gone: false,
      retry: false,
    });
    const boom = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    expect(await sendPush(sub, {}, keys, "mailto:a@b.test", { fetchImpl: boom })).toMatchObject({
      status: 0,
      retry: true,
    });
  });
});
