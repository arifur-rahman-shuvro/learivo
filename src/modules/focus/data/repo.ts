import type { FocusRecord } from "../domain/engine.ts";
import type { FocusSettings } from "../domain/settings.ts";

export interface FocusRepo {
  /** Newest first. */
  list(): Promise<FocusRecord[]>;
  /** Saves a finished session. Saving the same id again changes nothing. */
  save(record: FocusRecord): Promise<void>;
  remove(id: string): Promise<void>;
  /** Null when the student has never saved settings. */
  settings(): Promise<FocusSettings | null>;
  saveSettings(settings: FocusSettings): Promise<void>;
}
