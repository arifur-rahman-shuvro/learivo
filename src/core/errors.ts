export type ErrorKind = "network" | "session" | "unknown";

export interface Described {
  kind: ErrorKind;
  /** What happened, in plain words. */
  title: string;
  /** What the student can do about it. */
  advice: string;
}

const text = (e: unknown) => {
  if (typeof e === "string") return e;
  const o = e as { name?: unknown; message?: unknown } | null;
  return o && typeof o === "object" ? `${String(o.name ?? "")} ${String(o.message ?? "")}` : "";
};

/** Sorts a failure into something the student can act on. */
export function describeError(e: unknown): Described {
  const m = text(e);
  if (
    /jwt|refresh token|not authenticated|session (has )?(expired|ended)|invalid token|\b401\b/i.test(
      m,
    )
  ) {
    return {
      kind: "session",
      title: "Your session has ended.",
      advice: "Sign in again. Changes waiting on this device are kept and sent after you sign in.",
    };
  }
  if (
    e instanceof TypeError ||
    /failed to fetch|network|load failed|timed? ?out|offline|connection|dynamically imported module|chunk/i.test(
      m,
    )
  ) {
    return {
      kind: "network",
      title: "The connection dropped.",
      advice: "Check your internet, then try again. Your changes on this device are safe.",
    };
  }
  return {
    kind: "unknown",
    title: "Something went wrong on this screen.",
    advice: "Try again. If it keeps happening, reload the app. Your saved data is not affected.",
  };
}

/** Failures that are the student's own doing or harmless, and need no message. */
export function isQuiet(e: unknown): boolean {
  return /abort|cancel|ResizeObserver loop/i.test(text(e));
}
