import { useSyncExternalStore } from "react";
import type { ProviderId } from "./providers.ts";

/**
 * What this device has asked of each AI provider. It is only a counter kept in browser storage, so
 * the student can see how much they use. The provider's own page is the true bill.
 */
const STORE = "learivo.ai.usage";

export interface Usage {
  /** Day the "today" numbers belong to, as YYYY-MM-DD in local time. */
  day: string;
  todayRequests: number;
  todayTokens: number;
  requests: number;
  tokens: number;
}

type All = Partial<Record<ProviderId, Usage>>;

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

function read(): All {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORE) ?? "null");
    if (!raw || typeof raw !== "object") return {};
    const out: All = {};
    for (const [k, v] of Object.entries(raw)) {
      const u = (v ?? {}) as Record<string, unknown>;
      out[k as ProviderId] = {
        day: typeof u.day === "string" ? u.day : today(),
        todayRequests: num(u.todayRequests),
        todayTokens: num(u.todayTokens),
        requests: num(u.requests),
        tokens: num(u.tokens),
      };
    }
    return out;
  } catch {
    return {};
  }
}

let state: All = read();
const listeners = new Set<() => void>();

function commit(next: All) {
  state = next;
  try {
    window.localStorage.setItem(STORE, JSON.stringify(next));
  } catch {
    // Without storage the counter lasts until the page is closed.
  }
  listeners.forEach((l) => l());
}

/** Counts one request to a provider, with the tokens it reported (0 when it reported none). */
export function recordUse(provider: ProviderId, tokens: number): void {
  const d = today();
  const cur = state[provider];
  const base: Usage =
    cur && cur.day === d
      ? cur
      : {
          day: d,
          todayRequests: 0,
          todayTokens: 0,
          requests: cur?.requests ?? 0,
          tokens: cur?.tokens ?? 0,
        };
  const t = num(tokens);
  commit({
    ...state,
    [provider]: {
      ...base,
      todayRequests: base.todayRequests + 1,
      todayTokens: base.todayTokens + t,
      requests: base.requests + 1,
      tokens: base.tokens + t,
    },
  });
}

export function resetUsage(): void {
  commit({});
}

export function reloadUsage(): void {
  state = read();
  listeners.forEach((l) => l());
}

/** The counter for a provider, with "today" set to zero when the saved day is an earlier one. */
export function usageOf(provider: ProviderId, all: All = state): Usage {
  const u = all[provider];
  const d = today();
  if (!u) return { day: d, todayRequests: 0, todayTokens: 0, requests: 0, tokens: 0 };
  return u.day === d ? u : { ...u, day: d, todayRequests: 0, todayTokens: 0 };
}

export function useUsage(provider: ProviderId): Usage {
  const all = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  return usageOf(provider, all);
}
