/**
 * Sync skeleton: a queue of pending changes and the conflict rule from the blueprint.
 * Nothing here talks to the network yet; the transport arrives with the Go API.
 */

export interface PendingChange {
  /** Client-generated UUID, so a retry never creates a duplicate. */
  id: string;
  table: string;
  rowId: string;
  /** The server version this change was based on. */
  baseVersion: number;
  fields: Record<string, unknown>;
  createdAt: number;
}

export type Resolution =
  | { kind: "accept"; version: number }
  | { kind: "merge"; fields: Record<string, unknown> }
  | { kind: "conflict"; fields: string[] };

export class Outbox {
  private readonly queue: PendingChange[] = [];

  /** Add a change. A change with an id already queued is ignored (idempotent). */
  enqueue(change: PendingChange): boolean {
    if (this.queue.some((c) => c.id === change.id)) return false;
    this.queue.push(change);
    return true;
  }

  /** Pending changes in the order they were made. */
  pending(): readonly PendingChange[] {
    return [...this.queue].sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Remove a change once the server has accepted it. */
  markDone(id: string): void {
    const i = this.queue.findIndex((c) => c.id === id);
    if (i >= 0) this.queue.splice(i, 1);
  }

  get size(): number {
    return this.queue.length;
  }
}

/**
 * Decide what to do with a change given the row as the server holds it.
 * - Same base version: accept.
 * - Server moved on, but different fields changed: merge field by field.
 * - Server moved on and the same field changed: conflict, the student decides.
 */
export function resolveChange(
  change: PendingChange,
  server: { version: number; changedFieldsSinceBase: readonly string[] },
): Resolution {
  if (server.version === change.baseVersion) {
    return { kind: "accept", version: server.version + 1 };
  }
  const mine = Object.keys(change.fields);
  const clash = mine.filter((f) => server.changedFieldsSinceBase.includes(f));
  if (clash.length > 0) return { kind: "conflict", fields: clash };
  return { kind: "merge", fields: change.fields };
}
