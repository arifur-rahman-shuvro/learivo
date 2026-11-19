import { config } from "./config.ts";

/** Strips anything that could identify the student or hold question content before it is sent. */
export function scrub<T extends { user?: unknown; request?: unknown; breadcrumbs?: unknown }>(
  event: T,
): T {
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  return event;
}

/**
 * Starts crash reporting, but only when a DSN was provided at build time. Without one this does
 * nothing and the reporting library is never even downloaded.
 */
export async function startMonitoring(dsn: string = config.sentryDsn): Promise<boolean> {
  if (!dsn) return false;
  try {
    const Sentry = await import("@sentry/browser");
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
