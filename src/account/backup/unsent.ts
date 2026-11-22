/** The parts of the offline layer a backup needs. */
export interface OfflineParts {
  pack: { flushEdits(): Promise<unknown>; pendingSummaries(): Promise<string[]> };
  ws: { flush(): Promise<void>; pendingSummaries(): Promise<string[]> } | null;
}

/**
 * A backup reads what the server holds, so changes still waiting on this device would be missing
 * from it. This tries to send them first and returns what could not be sent (empty when all is in).
 */
export async function unsentBeforeBackup(parts: OfflineParts | null): Promise<string[]> {
  if (!parts) return [];
  await parts.pack.flushEdits().catch(() => undefined);
  await parts.ws?.flush().catch(() => undefined);
  return [
    ...(await parts.pack.pendingSummaries()),
    ...((await parts.ws?.pendingSummaries()) ?? []),
  ];
}
