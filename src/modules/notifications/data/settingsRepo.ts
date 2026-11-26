import { supabase } from "../../../core/supabase.ts";
import { DEFAULT_SETTINGS, fromRow, toRow, type PushSettings } from "../domain/settings.ts";

/** Reads and writes the student's push settings and the hours they study at. */
export interface PushSettingsRepo {
  load(): Promise<PushSettings>;
  save(s: PushSettings): Promise<void>;
  /** Start times of the latest finished sessions, newest first, for finding the usual study hour. */
  recentStarts(): Promise<string[]>;
}

export class SupabasePushSettings implements PushSettingsRepo {
  constructor(private readonly userId: string) {}

  async load(): Promise<PushSettings> {
    const { data, error } = await supabase
      .from("push_settings")
      .select("enabled, tone, study_time, quiet_start, quiet_end, kinds, max_per_day")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data) : { ...DEFAULT_SETTINGS };
  }

  async save(s: PushSettings): Promise<void> {
    const { error } = await supabase
      .from("push_settings")
      .upsert({ user_id: this.userId, ...toRow(s), updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }

  async recentStarts(): Promise<string[]> {
    const { data } = await supabase
      .from("attempts")
      .select("started_at")
      .eq("status", "submitted")
      .order("started_at", { ascending: false })
      .limit(120);
    return (data ?? []).map((r) => r.started_at as string);
  }
}
