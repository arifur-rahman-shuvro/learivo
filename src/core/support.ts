/** Where students write to for help, bug reports and feedback. */
export const SUPPORT_EMAIL = "learivo.official@gmail.com";

const KEEP = 8;
const recent: { at: string; text: string }[] = [];

/** Remembers a short description of a failure so a bug report can include it. Never question text. */
export function noteError(e: unknown): void {
  const raw =
    e instanceof Error ? `${e.name}: ${e.message}` : typeof e === "string" ? e : "Unknown error";
  recent.push({ at: new Date().toISOString(), text: raw.replace(/\s+/g, " ").slice(0, 160) });
  if (recent.length > KEEP) recent.shift();
}

export const recentErrors = (): readonly { at: string; text: string }[] => recent;

/** A ready-to-send email. The body carries only technical facts, never the student's content. */
export function supportMailto(kind: "problem" | "feedback"): string {
  const nav = typeof navigator === "undefined" ? null : navigator;
  const facts = [
    `App: Learivo ${typeof location === "undefined" ? "" : location.origin}`,
    `Browser: ${nav?.userAgent ?? "unknown"}`,
    `Online: ${nav ? (nav.onLine ? "yes" : "no") : "unknown"}`,
    `Screen: ${typeof window === "undefined" ? "?" : `${window.innerWidth}x${window.innerHeight}`}`,
    `Recent errors: ${recent.length === 0 ? "none" : ""}`,
    ...recent.map((r) => `  ${r.at} ${r.text}`),
  ];
  const lead =
    kind === "problem"
      ? "What went wrong? What did you tap just before? (Please do not write passwords or your question text.)"
      : "What would make Learivo better for you?";
  const subject = kind === "problem" ? "Learivo: problem report" : "Learivo: feedback";
  const body = `${lead}\n\n\n\n--- Technical details, safe to send ---\n${facts.join("\n")}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
