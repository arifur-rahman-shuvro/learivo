import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClearScope, DataCounts, DataRepo } from "./repo.ts";

function fail(e: { code?: string; message: string }): never {
  if (e.code === "42501" || e.code === "PGRST301")
    throw new Error("Your session has ended. Sign in again.");
  throw new Error("Could not reach your account. Check your connection and try again.");
}

function ok<T>(r: { data: T | null; error: { code?: string; message: string } | null }): T {
  if (r.error) fail(r.error);
  return r.data as T;
}

/** Rows removed per request, small enough to finish inside the database's time limit. */
const BATCH: Record<string, number> = { attempts: 100, questions: 500 };

export class SupabaseData implements DataRepo {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  private async count(table: string): Promise<number> {
    const r = await this.db.from(table).select("*", { count: "exact", head: true });
    if (r.error) fail(r.error);
    return r.count ?? 0;
  }

  async counts(): Promise<DataCounts> {
    const [questions, sessions, exams, cards, bookmarks, notes] = await Promise.all([
      this.count("questions"),
      this.count("attempts"),
      this.count("exams"),
      this.count("review_cards"),
      this.count("bookmarks"),
      this.count("notes"),
    ]);
    return { questions, sessions, exams, cards, bookmarks, notes };
  }

  /** Deletes the student's rows of one table, a batch at a time, until none are left. */
  private async wipe(table: string, idColumn = "id") {
    const size = BATCH[table] ?? 1000;
    for (let guard = 0; guard < 100000; guard++) {
      const rows = ok(
        await this.db.from(table).select(idColumn).eq("user_id", this.userId).limit(size),
      ) as unknown as Record<string, string>[];
      if (rows.length === 0) return;
      ok(
        await this.db
          .from(table)
          .delete()
          .eq("user_id", this.userId)
          .in(
            idColumn,
            rows.map((r) => r[idColumn]!),
          ),
      );
      if (rows.length < size) return;
    }
  }

  async clear(scope: ClearScope, onProgress: (done: string) => void = () => undefined) {
    const step = async (label: string, table: string, idColumn?: string) => {
      await this.wipe(table, idColumn);
      onProgress(label);
    };
    if (scope === "practice" || scope === "everything") {
      await step("Sessions", "attempts");
    }
    if (scope === "questions" || scope === "everything") {
      // Bookmarks, notes, revision cards, tags on questions and collection links go with the questions.
      await step("Questions", "questions");
    }
    if (scope === "everything") {
      await step("Exams", "exams");
      await step("Collections", "collections");
      await step("Tags", "tags");
      await step("Subjects", "taxonomy_nodes");
    }
  }
}
