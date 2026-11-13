import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card } from "../domain/scheduler.ts";
import {
  DEFAULT_GOAL,
  type CardRecord,
  type Note,
  type NoteInput,
  type WorkspaceRepo,
} from "./repo.ts";

interface Failure {
  code?: string;
  message: string;
}

function fail(e: Failure): never {
  if (e.code === "42501" || e.code === "PGRST301")
    throw new Error("Your session has ended. Sign in again.");
  if (e.code === "23514") throw new Error("That value is not allowed.");
  throw new Error("Could not reach your workspace. Check your connection and try again.");
}

function ok<T>(r: { data: T | null; error: Failure | null }): T {
  if (r.error) fail(r.error);
  return r.data as T;
}

interface NoteRow {
  id: string;
  question_id: string | null;
  title: string;
  body: string;
  updated_at: string;
}

interface CardRow {
  question_id: string;
  state: "new" | "review";
  due: string;
  stability: number | string;
  difficulty: number | string;
  reps: number;
  lapses: number;
  last_review: string | null;
}

const toNote = (r: NoteRow): Note => ({
  id: r.id,
  questionId: r.question_id,
  title: r.title,
  body: r.body,
  updatedAt: r.updated_at,
});

const toCard = (r: CardRow): CardRecord => ({
  questionId: r.question_id,
  state: r.state,
  due: r.due,
  stability: Number(r.stability),
  difficulty: Number(r.difficulty),
  reps: r.reps,
  lapses: r.lapses,
  lastReview: r.last_review,
});

export class SupabaseWorkspace implements WorkspaceRepo {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async bookmarks() {
    const out = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const rows = ok(
        await this.db
          .from("bookmarks")
          .select("question_id")
          .order("question_id")
          .range(from, from + 999),
      ) as { question_id: string }[];
      rows.forEach((r) => out.add(r.question_id));
      if (rows.length < 1000) break;
    }
    return out;
  }

  async setBookmark(questionId: string, on: boolean) {
    const res = on
      ? await this.db
          .from("bookmarks")
          .upsert(
            { user_id: this.userId, question_id: questionId },
            { onConflict: "user_id,question_id", ignoreDuplicates: true },
          )
      : await this.db.from("bookmarks").delete().eq("question_id", questionId);
    if (res.error) fail(res.error);
  }

  async notes() {
    const rows = ok(
      await this.db
        .from("notes")
        .select("id, question_id, title, body, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1000),
    ) as NoteRow[];
    return rows.map(toNote);
  }

  async saveNote(input: NoteInput) {
    if (input.body.trim() === "") throw new Error("Write something in the note.");
    const fields = { title: input.title, body: input.body };
    const cols = "id, question_id, title, body, updated_at";
    if (input.id) {
      return toNote(
        ok(
          await this.db.from("notes").update(fields).eq("id", input.id).select(cols).single(),
        ) as NoteRow,
      );
    }
    if (input.questionId) {
      // One note per question: writing again replaces it.
      return toNote(
        ok(
          await this.db
            .from("notes")
            .upsert(
              { user_id: this.userId, question_id: input.questionId, ...fields },
              { onConflict: "user_id,question_id" },
            )
            .select(cols)
            .single(),
        ) as NoteRow,
      );
    }
    return toNote(
      ok(
        await this.db
          .from("notes")
          .insert({ user_id: this.userId, question_id: null, ...fields })
          .select(cols)
          .single(),
      ) as NoteRow,
    );
  }

  async deleteNote(id: string) {
    const res = await this.db.from("notes").delete().eq("id", id);
    if (res.error) fail(res.error);
  }

  async cards() {
    const out: CardRecord[] = [];
    for (let from = 0; ; from += 1000) {
      const rows = ok(
        await this.db
          .from("review_cards")
          .select("question_id, state, due, stability, difficulty, reps, lapses, last_review")
          .order("question_id")
          .range(from, from + 999),
      ) as CardRow[];
      out.push(...rows.map(toCard));
      if (rows.length < 1000) break;
    }
    return out;
  }

  async addCards(questionIds: string[]) {
    const ids = [...new Set(questionIds)];
    for (let i = 0; i < ids.length; i += 200) {
      const res = await this.db.from("review_cards").upsert(
        ids.slice(i, i + 200).map((question_id) => ({ user_id: this.userId, question_id })),
        { onConflict: "user_id,question_id", ignoreDuplicates: true },
      );
      if (res.error) fail(res.error);
    }
  }

  async saveCard(questionId: string, c: Card) {
    const res = await this.db.from("review_cards").upsert(
      {
        user_id: this.userId,
        question_id: questionId,
        state: c.state,
        due: c.due,
        stability: c.stability,
        difficulty: c.difficulty,
        reps: c.reps,
        lapses: c.lapses,
        last_review: c.lastReview,
      },
      { onConflict: "user_id,question_id" },
    );
    if (res.error) fail(res.error);
  }

  async removeCard(questionId: string) {
    const res = await this.db.from("review_cards").delete().eq("question_id", questionId);
    if (res.error) fail(res.error);
  }

  async dailyGoal() {
    const row = ok(await this.db.from("user_preferences").select("daily_goal").maybeSingle()) as {
      daily_goal: number;
    } | null;
    return row?.daily_goal ?? DEFAULT_GOAL;
  }

  async setDailyGoal(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > 500) throw new Error("Choose a goal from 1 to 500.");
    const res = await this.db
      .from("user_preferences")
      .update({ daily_goal: n })
      .eq("user_id", this.userId);
    if (res.error) fail(res.error);
  }
}
