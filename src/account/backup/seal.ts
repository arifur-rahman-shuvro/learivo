/**
 * Optional passphrase protection for a backup file. The passphrase never leaves the device and is
 * not stored: AES-GCM with a key made from it (PBKDF2, SHA-256). A forgotten passphrase cannot be
 * recovered.
 */
const FORMAT = "learivo-backup-encrypted";
const ITERATIONS = 310_000;
export const MIN_PASSPHRASE = 8;

interface Envelope {
  format: typeof FORMAT;
  version: 1;
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFor(pass: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pass),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypts backup text into a JSON file body. */
export async function seal(text: string, pass: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(pass, salt, ITERATIONS);
  const data = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text)),
  );
  const env: Envelope = {
    format: FORMAT,
    version: 1,
    iterations: ITERATIONS,
    salt: b64(salt),
    iv: b64(iv),
    data: b64(data),
  };
  return JSON.stringify(env);
}

function envelope(text: string): Envelope | null {
  try {
    const o = JSON.parse(text) as Partial<Envelope> | null;
    if (
      o?.format === FORMAT &&
      o.version === 1 &&
      typeof o.salt === "string" &&
      typeof o.iv === "string" &&
      typeof o.data === "string" &&
      Number.isInteger(o.iterations) &&
      o.iterations! >= 100_000 &&
      o.iterations! <= 2_000_000
    ) {
      return o as Envelope;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/** True when the file is a passphrase-protected backup. */
export const isSealed = (text: string) => envelope(text) !== null;

/** Decrypts a protected backup, or throws a plain message for a wrong passphrase or damaged file. */
export async function unseal(text: string, pass: string): Promise<string> {
  const env = envelope(text);
  if (!env) throw new Error("This file is not a protected Learivo backup.");
  try {
    const key = await keyFor(pass, unb64(env.salt), env.iterations);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(env.iv) as BufferSource },
      key,
      unb64(env.data) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("That passphrase does not open this backup, or the file is damaged.");
  }
}
