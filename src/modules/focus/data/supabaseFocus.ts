import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRows, type RowSpec } from "../../../core/rowCheck.ts";
import type { FocusRecord } from "../domain/engine.ts";
import { cleanSettings, type FocusSettings } from "../domain/settings.ts";
import type { FocusRepo } from "./repo.ts";

interface Row {
  id: string;
  kind: FocusRecord["kind"];
  status: FocusRecord["status"];
  started_at: string;
  ended_at: string;
  focus_seconds: number;
  planned_seconds: number | null;
  local_day: string;
}

const SPEC: RowSpec = {
  id: "string",
  kind: ["pomodoro", "stopwatch", "countdown", "custom"],
  status: ["completed", "interrupted", "cancelled"],
  started_at: "string",
  ended_at: "string",
  focus_seconds: "number",
  planned_seconds: { optional: "number" },
  local_day: "string",
};

function fail(e: { code?: string }): never {
  if (e.code === "42501" || e.code === "PGRST301")
    throw new Error("Your session has ended. Sign in again.");
  throw new Error("Could not reach your study data. Check your connection and try again.");
}

/** Newest 3000 sessions: years of daily use, and a hard stop on a very large read. */
const LIMIT = 3000;

export class SupabaseFocus implements FocusRepo {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async list() {
    const res = await this.db
      .from("focus_sessions")
      .select("id, kind, status, started_at, ended_at, focus_seconds, planned_seconds, local_day")
      .order("started_at", { ascending: false })
      .limit(LIMIT);
    if (res.error) fail(res.error);
    const rows = checkRows<Row>("focus_sessions", res.data ?? [], SPEC);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      focusSeconds: r.focus_seconds,
      plannedSeconds: r.planned_seconds,
      localDay: r.local_day,
    }));
  }

  async save(r: FocusRecord) {
    // "Do nothing on conflict": a retry of a session that already arrived adds no second row.
    const res = await this.db.from("focus_sessions").upsert(
      {
        id: r.id,
        user_id: this.userId,
        kind: r.kind,
        status: r.status,
        started_at: r.startedAt,
        ended_at: r.endedAt,
        focus_seconds: r.focusSeconds,
        planned_seconds: r.plannedSeconds,
        local_day: r.localDay,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (res.error) fail(res.error);
  }

  async remove(id: string) {
    const res = await this.db.from("focus_sessions").delete().eq("id", id);
    if (res.error) fail(res.error);
  }

  async settings() {
    const res = await this.db.from("focus_settings").select("settings").maybeSingle();
    if (res.error) fail(res.error);
    const row = res.data as { settings: unknown } | null;
    return row ? cleanSettings(row.settings) : null;
  }

  async saveSettings(s: FocusSettings) {
    const res = await this.db
      .from("focus_settings")
      .upsert({ user_id: this.userId, settings: s, updated_at: new Date().toISOString() });
    if (res.error) fail(res.error);
  }
}
