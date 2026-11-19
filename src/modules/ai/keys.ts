import { useSyncExternalStore } from "react";
import { providerOf, PROVIDERS, type AiConfig, type ProviderId } from "./providers.ts";

/**
 * The student's AI keys live only on this device (browser storage). They are never sent to
 * Learivo's servers or saved in the database.
 */
const STORE = "learivo.ai";

interface Saved {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
}

const EMPTY: Saved = { provider: "gemini", keys: {}, models: {} };
let state: Saved = read();
const listeners = new Set<() => void>();

function read(): Saved {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORE) ?? "null");
    if (!raw || typeof raw !== "object") return EMPTY;
    const o = raw as Partial<Saved>;
    const ids = PROVIDERS.map((p) => p.id);
    const pick = (m: unknown) =>
      Object.fromEntries(
        Object.entries(m && typeof m === "object" ? m : {}).filter(
          ([k, v]) => ids.includes(k as ProviderId) && typeof v === "string",
        ),
      ) as Partial<Record<ProviderId, string>>;
    return {
      provider: ids.includes(o.provider as ProviderId) ? (o.provider as ProviderId) : "gemini",
      keys: pick(o.keys),
      models: pick(o.models),
    };
  } catch {
    return EMPTY;
  }
}

function commit(next: Saved) {
  state = next;
  try {
    window.localStorage.setItem(STORE, JSON.stringify(next));
  } catch {
    // Without storage the key lasts until the page is closed.
  }
  listeners.forEach((l) => l());
}

export const aiState = (): Saved => state;

/** The chosen provider's settings, or null when no key is saved for it. */
export function activeConfig(s: Saved = state): AiConfig | null {
  const key = (s.keys[s.provider] ?? "").trim();
  if (!key) return null;
  return {
    provider: s.provider,
    key,
    model: s.models[s.provider]?.trim() || providerOf(s.provider).defaultModel,
  };
}

export function saveAi(provider: ProviderId, key: string, model: string) {
  commit({
    provider,
    keys: { ...state.keys, [provider]: key.trim() },
    models: { ...state.models, [provider]: model.trim() },
  });
}

export function removeKey(provider: ProviderId) {
  const keys = { ...state.keys };
  delete keys[provider];
  commit({ ...state, keys });
}

/** Forgets every key. Used when the student signs out, so the next person on this device has none. */
export function forgetAllKeys() {
  commit({ ...state, keys: {} });
}

export function useAiState(): Saved {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => state,
    () => EMPTY,
  );
}

/** Test helper: reload from storage. */
export function reloadAi() {
  state = read();
  listeners.forEach((l) => l());
}
