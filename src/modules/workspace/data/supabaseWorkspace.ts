import {
  cleanFlashcard,
  cleanTerm,
  sortTerms,
  type Flashcard,
  type FlashcardInput,
  type GlossaryTerm,
  type TermInput,
} from "../domain/cards.ts";
import { cleanExamTarget, type ExamTarget } from "../domain/examTarget.ts";
import { cleanLayout, type HomeLayout } from "../domain/homeLayout.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRow, checkRows, opt, type RowSpec } from "../../../core/rowCheck.ts";
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

const CARD_COLUMNS = "state, due, stability, difficulty, reps, lapses, last_review";

interface FlashRow extends Omit<CardRow, "question_id"> {
  id: string;
  front: string;
  back: string;
}

const CARD_FIELDS: RowSpec = {
  state: ["new", "review"],
  due: "string",
  stability: "numeric",
  difficulty: "numeric",
  reps: "number",
  lapses: "number",
  last_review: opt("string"),
};
const NOTE_ROW: RowSpec = {
  id: "string",
  question_id: opt("string"),
  title: "string",
  body: "string",
  updated_at: "string",
};
const CARD_ROW: RowSpec = { question_id: "string", ...CARD_FIELDS };
const FLASH_ROW: RowSpec = { id: "string", front: "string", back: "string", ...CARD_FIELDS };
const TERM_ROW: RowSpec = { id: "string", term: "string", definition: "string" };

const toFlashcard = (r0: FlashRow): Flashcard => {
  const r = checkRow<FlashRow>("flashcards", r0, FLASH_ROW);
  return {
    id: r.id,
    front: r.front,
    back: r.back,
    state: r.state,
    due: r.due,
    stability: Number(r.stability),
    difficulty: Number(r.difficulty),
    reps: r.reps,
    lapses: r.lapses,
    lastReview: r.last_review,
  };
};

const toNote = (r0: NoteRow): Note => {
  const r = checkRow<NoteRow>("notes", r0, NOTE_ROW);
  return {
    id: r.id,
    questionId: r.question_id,
    title: r.title,
    body: r.body,
    updatedAt: r.updated_at,
  };
};

const toCard = (r0: CardRow): CardRecord => {
  const r = checkRow<CardRow>("review_cards", r0, CARD_ROW);
  return {
    questionId: r.question_id,
    state: r.state,
    due: r.due,
    stability: Number(r.stability),
    difficulty: Number(r.difficulty),
    reps: r.reps,
    lapses: r.lapses,
    lastReview: r.last_review,
  };
};

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
              {
                ...(input.newId ? { id: input.newId } : {}),
                user_id: this.userId,
                question_id: input.questionId,
                ...fields,
              },
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
          .upsert(
            {
              ...(input.newId ? { id: input.newId } : {}),
              user_id: this.userId,
              question_id: null,
              ...fields,
            },
            { onConflict: "id" },
          )
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

  async flashcards() {
    const out: Flashcard[] = [];
    for (let from = 0; ; from += 1000) {
      const rows = ok(
        await this.db
          .from("flashcards")
          .select(`id, front, back, ${CARD_COLUMNS}`)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, from + 999),
      ) as FlashRow[];
      out.push(...rows.map(toFlashcard));
      if (rows.length < 1000) break;
    }
    return out;
  }

  async saveFlashcard(input: FlashcardInput) {
    const clean = cleanFlashcard(input);
    const cols = `id, front, back, ${CARD_COLUMNS}`;
    if (clean.id) {
      return toFlashcard(
        ok(
          await this.db
            .from("flashcards")
            .update({ front: clean.front, back: clean.back })
            .eq("id", clean.id)
            .select(cols)
            .single(),
        ) as FlashRow,
      );
    }
    return toFlashcard(
      ok(
        await this.db
          .from("flashcards")
          .upsert(
            {
              ...(clean.newId ? { id: clean.newId } : {}),
              user_id: this.userId,
              front: clean.front,
              back: clean.back,
            },
            { onConflict: "id" },
          )
          .select(cols)
          .single(),
      ) as FlashRow,
    );
  }

  async rateFlashcard(id: string, c: Card) {
    const res = await this.db
      .from("flashcards")
      .update({
        state: c.state,
        due: c.due,
        stability: c.stability,
        difficulty: c.difficulty,
        reps: c.reps,
        lapses: c.lapses,
        last_review: c.lastReview,
      })
      .eq("id", id);
    if (res.error) fail(res.error);
  }

  async deleteFlashcard(id: string) {
    const res = await this.db.from("flashcards").delete().eq("id", id);
    if (res.error) fail(res.error);
  }

  async glossary() {
    const rows = ok(
      await this.db.from("glossary_terms").select("id, term, definition").order("term").limit(5000),
    ) as GlossaryTerm[];
    return sortTerms(checkRows<GlossaryTerm>("glossary_terms", rows, TERM_ROW));
  }

  async saveTerm(input: TermInput) {
    const clean = cleanTerm(input);
    const fields = { term: clean.term, definition: clean.definition };
    const res = clean.id
      ? await this.db
          .from("glossary_terms")
          .update(fields)
          .eq("id", clean.id)
          .select("id, term, definition")
          .single()
      : await this.db
          .from("glossary_terms")
          .upsert(
            { ...(clean.newId ? { id: clean.newId } : {}), user_id: this.userId, ...fields },
            { onConflict: "id" },
          )
          .select("id, term, definition")
          .single();
    if (res.error?.code === "23505") throw new Error("You already have a term with that name.");
    return checkRow<GlossaryTerm>("glossary_terms", ok(res), TERM_ROW);
  }

  async deleteTerm(id: string) {
    const res = await this.db.from("glossary_terms").delete().eq("id", id);
    if (res.error) fail(res.error);
  }

  async examTarget() {
    const row = ok(
      await this.db
        .from("user_preferences")
        .select("exam_title, exam_date, exam_subjects")
        .maybeSingle(),
    ) as { exam_title: string; exam_date: string | null; exam_subjects: string[] | null } | null;
    return cleanExamTarget({
      title: row?.exam_title,
      date: row?.exam_date,
      subjectIds: row?.exam_subjects,
    });
  }

  async setExamTarget(target: ExamTarget) {
    const t = cleanExamTarget(target);
    const res = await this.db
      .from("user_preferences")
      .update({ exam_title: t.title, exam_date: t.date, exam_subjects: t.subjectIds })
      .eq("user_id", this.userId);
    if (res.error) fail(res.error);
  }

  async homeLayout() {
    const row = ok(await this.db.from("user_preferences").select("home_layout").maybeSingle()) as {
      home_layout: unknown;
    } | null;
    return cleanLayout(row?.home_layout);
  }

  async setHomeLayout(layout: HomeLayout) {
    const res = await this.db
      .from("user_preferences")
      .update({ home_layout: cleanLayout(layout) })
      .eq("user_id", this.userId);
    if (res.error) fail(res.error);
  }
}
