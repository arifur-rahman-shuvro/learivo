import type { SupabaseClient } from "@supabase/supabase-js";
import type { Response, Snapshot, Verdict } from "../domain/grading.ts";
import type { ExamRule, Past } from "../domain/session.ts";
import type { Fact } from "../../workspace/domain/insights.ts";
import type {
  Attempt,
  AttemptItem,
  AttemptRepo,
  AttemptWithItems,
  Exam,
  ExamInput,
  Graded,
  ItemPatch,
  NewAttempt,
  Totals,
} from "./repo.ts";

interface AttemptRow {
  id: string;
  kind: "practice" | "exam";
  exam_id: string | null;
  title: string;
  status: "in_progress" | "submitted";
  instant_feedback: boolean;
  time_limit_sec: number | null;
  marks_correct: number | string;
  marks_wrong: number | string;
  question_count: number;
  score: number | string | null;
  correct_count: number | null;
  wrong_count: number | null;
  unanswered_count: number | null;
  seconds_spent: number;
  started_at: string;
  submitted_at: string | null;
}

interface ItemRow {
  position: number;
  question_id: string | null;
  snapshot: Snapshot;
  response: Response | null;
  flagged: boolean;
  is_correct: boolean | null;
  marks: number | string | null;
  answered_at: string | null;
}

interface ExamRow {
  id: string;
  title: string;
  instructions: string;
  time_limit_sec: number | null;
  marks_correct: number | string;
  marks_wrong: number | string;
  randomize: boolean;
  rules: ExamRule[];
  updated_at: string;
}

interface Failure {
  code?: string;
  message: string;
}

function fail(e: Failure): never {
  if (e.code === "42501" || e.code === "PGRST301")
    throw new Error("Your session has ended. Sign in again.");
  throw new Error("Could not reach your sessions. Check your connection and try again.");
}

function ok<T>(r: { data: T | null; error: Failure | null }): T {
  if (r.error) fail(r.error);
  return r.data as T;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

const ATTEMPT_COLUMNS =
  "id, kind, exam_id, title, status, instant_feedback, time_limit_sec, marks_correct, marks_wrong, question_count, score, correct_count, wrong_count, unanswered_count, seconds_spent, started_at, submitted_at";

function toAttempt(r: AttemptRow): Attempt {
  return {
    id: r.id,
    kind: r.kind,
    examId: r.exam_id,
    title: r.title,
    status: r.status,
    instantFeedback: r.instant_feedback,
    timeLimitSec: r.time_limit_sec,
    marksCorrect: Number(r.marks_correct),
    marksWrong: Number(r.marks_wrong),
    questionCount: r.question_count,
    score: num(r.score),
    correct: r.correct_count,
    wrong: r.wrong_count,
    unanswered: r.unanswered_count,
    secondsSpent: r.seconds_spent,
    startedAt: r.started_at,
    submittedAt: r.submitted_at,
  };
}

function toVerdict(correct: boolean | null, response: Response | null): Verdict | null {
  if (correct === true) return "correct";
  if (correct === false) return response === null ? "unanswered" : "wrong";
  return null;
}

const toExam = (r: ExamRow): Exam => ({
  id: r.id,
  title: r.title,
  instructions: r.instructions,
  timeLimitSec: r.time_limit_sec,
  marksCorrect: Number(r.marks_correct),
  marksWrong: Number(r.marks_wrong),
  randomize: r.randomize,
  rules: r.rules,
  updatedAt: r.updated_at,
});

export class SupabaseAttempts implements AttemptRepo {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async create(input: NewAttempt) {
    const head = ok(
      await this.db
        .from("attempts")
        .insert({
          user_id: this.userId,
          kind: input.kind,
          exam_id: input.examId,
          title: input.title,
          instant_feedback: input.instantFeedback,
          time_limit_sec: input.timeLimitSec,
          marks_correct: input.marksCorrect,
          marks_wrong: input.marksWrong,
          question_count: input.items.length,
        })
        .select("id")
        .single(),
    ) as { id: string };
    const rows = input.items.map((x, position) => ({
      attempt_id: head.id,
      user_id: this.userId,
      position,
      question_id: x.questionId,
      snapshot: x.snapshot,
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const res = await this.db.from("attempt_items").insert(rows.slice(i, i + 200));
      if (res.error) {
        // Do not leave an attempt with missing questions behind.
        await this.db.from("attempts").delete().eq("id", head.id);
        fail(res.error);
      }
    }
    return head.id;
  }

  async get(id: string): Promise<AttemptWithItems | null> {
    const head = ok(
      await this.db.from("attempts").select(ATTEMPT_COLUMNS).eq("id", id).maybeSingle(),
    ) as AttemptRow | null;
    if (!head) return null;
    const rows = ok(
      await this.db
        .from("attempt_items")
        .select(
          "position, question_id, snapshot, response, flagged, is_correct, marks, answered_at",
        )
        .eq("attempt_id", id)
        .order("position")
        .range(0, 999),
    ) as ItemRow[];
    const items: AttemptItem[] = rows.map((r) => ({
      position: r.position,
      questionId: r.question_id,
      snapshot: r.snapshot,
      response: r.response,
      flagged: r.flagged,
      verdict: toVerdict(r.is_correct, r.response),
      marks: num(r.marks),
    }));
    return { ...toAttempt(head), items };
  }

  async list(limit: number) {
    const rows = ok(
      await this.db
        .from("attempts")
        .select(ATTEMPT_COLUMNS)
        .order("started_at", { ascending: false })
        .limit(limit),
    ) as AttemptRow[];
    return rows.map(toAttempt);
  }

  async patchItem(attemptId: string, position: number, patch: ItemPatch) {
    const update: Record<string, unknown> = {};
    if ("response" in patch) {
      update.response = patch.response ?? null;
      update.answered_at = patch.response ? new Date().toISOString() : null;
    }
    if (patch.flagged !== undefined) update.flagged = patch.flagged;
    if (Object.keys(update).length === 0) return;
    const res = await this.db
      .from("attempt_items")
      .update(update)
      .eq("attempt_id", attemptId)
      .eq("position", position);
    if (res.error) fail(res.error);
  }

  async submit(attemptId: string, graded: Graded[], totals: Totals) {
    // Grades first, then the attempt, so a half-finished submit can be repeated safely.
    for (const g of graded) {
      const res = await this.db
        .from("attempt_items")
        .update({
          is_correct: g.verdict === "unanswered" ? false : g.verdict === "correct",
          marks: g.marks,
        })
        .eq("attempt_id", attemptId)
        .eq("position", g.position);
      if (res.error) fail(res.error);
    }
    const res = await this.db
      .from("attempts")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        score: totals.score,
        correct_count: totals.correct,
        wrong_count: totals.wrong,
        unanswered_count: totals.unanswered,
        seconds_spent: totals.secondsSpent,
      })
      .eq("id", attemptId)
      .eq("status", "in_progress");
    if (res.error) fail(res.error);
  }

  async remove(attemptId: string) {
    const res = await this.db.from("attempts").delete().eq("id", attemptId);
    if (res.error) fail(res.error);
  }

  async facts(limit: number): Promise<Fact[]> {
    const out: Fact[] = [];
    for (let from = 0; out.length < limit; from += 1000) {
      const rows = ok(
        await this.db
          .from("attempt_items")
          .select("is_correct, response, path:snapshot->path, attempts!inner(submitted_at, status)")
          .not("is_correct", "is", null)
          .not("response", "is", null)
          .eq("attempts.status", "submitted")
          .order("answered_at", { ascending: false })
          .range(from, from + 999),
      ) as unknown as {
        is_correct: boolean;
        path: string[] | null;
        attempts: { submitted_at: string };
      }[];
      for (const r of rows) {
        out.push({ at: r.attempts.submitted_at, path: r.path ?? [], correct: r.is_correct });
      }
      if (rows.length < 1000) break;
    }
    return out.slice(0, limit);
  }

  async past() {
    const out = new Map<string, Past>();
    for (let from = 0; ; from += 1000) {
      const rows = ok(
        await this.db
          .from("attempt_items")
          .select("question_id, is_correct, response, attempts!inner(started_at, status)")
          .not("question_id", "is", null)
          .not("is_correct", "is", null)
          .eq("attempts.status", "submitted")
          .order("question_id")
          .order("position")
          .range(from, from + 999),
      ) as unknown as {
        question_id: string;
        is_correct: boolean;
        response: Response | null;
        attempts: { started_at: string };
      }[];
      // Oldest first, so the final write for a question is its latest answer.
      rows.sort((a, b) => a.attempts.started_at.localeCompare(b.attempts.started_at));
      for (const r of rows) {
        if (r.response === null) continue; // skipped: neither right nor wrong
        const prev = out.get(r.question_id);
        out.set(r.question_id, {
          last: r.is_correct ? "correct" : "wrong",
          times: (prev?.times ?? 0) + 1,
        });
      }
      if (rows.length < 1000) break;
    }
    return out;
  }

  async exams() {
    const rows = ok(
      await this.db
        .from("exams")
        .select(
          "id, title, instructions, time_limit_sec, marks_correct, marks_wrong, randomize, rules, updated_at",
        )
        .order("updated_at", { ascending: false }),
    ) as ExamRow[];
    return rows.map(toExam);
  }

  async saveExam(id: string | null, input: ExamInput) {
    const row = {
      title: input.title.trim(),
      instructions: input.instructions,
      time_limit_sec: input.timeLimitSec,
      marks_correct: input.marksCorrect,
      marks_wrong: input.marksWrong,
      randomize: input.randomize,
      rules: input.rules,
    };
    if (id) {
      const res = await this.db.from("exams").update(row).eq("id", id);
      if (res.error) fail(res.error);
      return id;
    }
    const made = ok(
      await this.db
        .from("exams")
        .insert({ ...row, user_id: this.userId })
        .select("id")
        .single(),
    ) as { id: string };
    return made.id;
  }

  async deleteExam(id: string) {
    const res = await this.db.from("exams").delete().eq("id", id);
    if (res.error) fail(res.error);
  }
}
