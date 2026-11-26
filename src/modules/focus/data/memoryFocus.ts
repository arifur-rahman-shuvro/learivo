import type { FocusRecord } from "../domain/engine.ts";
import type { FocusSettings } from "../domain/settings.ts";
import type { FocusRepo } from "./repo.ts";

/** In-memory repo for tests and the signed-out demo. */
export class MemoryFocus implements FocusRepo {
  rows = new Map<string, FocusRecord>();
  stored: FocusSettings | null = null;
  /** Tests set this to make saving fail, like a lost connection. */
  offline = false;

  async list() {
    this.check();
    return [...this.rows.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async save(r: FocusRecord) {
    this.check();
    if (!this.rows.has(r.id)) this.rows.set(r.id, r);
  }
  async remove(id: string) {
    this.check();
    this.rows.delete(id);
  }
  async settings() {
    this.check();
    return this.stored;
  }
  async saveSettings(s: FocusSettings) {
    this.check();
    this.stored = s;
  }
  private check() {
    if (this.offline) throw new Error("offline");
  }
}
