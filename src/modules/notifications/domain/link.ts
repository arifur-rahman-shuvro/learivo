import type { Intent } from "../../../core/intents.ts";

/** Where a notification's tap leads: a screen, and sometimes a session to start right away. */
export interface Landing {
  route: string;
  intent: Intent | null;
}

export interface NotifyLink {
  go: string;
  id: string | null;
}

/** Reads "#/notify?go=weak%3ARenal&n=<id>". Returns null for any other address. */
export function parseNotifyHash(hash: string): NotifyLink | null {
  if (!hash.startsWith("#/notify")) return null;
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const p = new URLSearchParams(query);
  const id = p.get("n");
  return {
    go: (p.get("go") ?? "quick").slice(0, 120),
    id: id && /^[0-9a-f-]{36}$/.test(id) ? id : null,
  };
}

/** Turns the Coach's "go" value into a screen. Anything unknown opens a quick session, never an error. */
export function landingFor(go: string): Landing {
  if (go === "revision") return { route: "#/review", intent: null };
  if (go === "insights") return { route: "#/insights", intent: null };
  if (go.startsWith("weak:") && go.length > 5) {
    return { route: "#/practice", intent: { kind: "start", plan: "weak", subject: go.slice(5) } };
  }
  return { route: "#/practice", intent: { kind: "start", plan: "quick" } };
}
