import { config } from "./config.ts";
import { noteError } from "./support.ts";

/** Strips anything that could identify the student or hold question content before it is sent. */
export function scrub<T extends { user?: unknown; request?: unknown; breadcrumbs?: unknown }>(
  event: T,
): T {
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  return event;
}

let sentry: typeof import("@sentry/browser") | null = null;

/** Sends one handled failure to crash reporting, when it is on. Never throws. */
export function reportError(e: unknown): void {
  noteError(e);
  try {
    sentry?.captureException(e);
  } catch {
    /* reporting must never cause another failure */
  }
}

/**
 * Starts crash reporting, but only when a DSN was provided at build time. Without one this does
 * nothing and the reporting library is never even downloaded.
 */
export async function startMonitoring(dsn: string = config.sentryDsn): Promise<boolean> {
  if (!dsn) return false;
  try {
    const Sentry = await import("@sentry/browser");
    sentry = Sentry;
    Sentry.init({
      dsn,
      defaultIntegrations: false,
      integrations: [Sentry.globalHandlersIntegration(), Sentry.dedupeIntegration()],
      tracesSampleRate: 0,
      beforeSend: (event) => scrub(event),
    });
    return true;
  } catch {
    return false;
  }
}
