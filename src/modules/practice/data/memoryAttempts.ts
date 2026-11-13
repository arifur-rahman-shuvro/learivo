import type { Past } from "../domain/session.ts";
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

interface Stored extends AttemptWithItems {
  questionIds: string[];
}

/** In-memory attempts for tests and demos. Follows the same rules as the database. */
export class MemoryAttempts implements AttemptRepo {
  private attempts = new Map<string, Stored>();
  private examMap = new Map<string, Exam>();
  private seq = 0;
  private clock = Date.now();

  constructor(private readonly idPrefix = "att") {}

  /** Everything held, so it can be kept on a device and restored later. */
  dump(): { seq: number; attempts: unknown[] } {
    return { seq: this.seq, attempts: structuredClone([...this.attempts.values()]) };
  }

  restore(data: { seq: number; attempts: unknown[] }) {
    this.seq = Math.max(this.seq, data.seq);
    this.attempts = new Map((data.attempts as Stored[]).map((a) => [a.id, a]));
  }

  private tick() {
    this.clock = Math.max(this.clock + 1, Date.now());
    return new Date(this.clock).toISOString();
  }

  async create(input: NewAttempt) {
    if (input.items.length < 1 || input.items.length > 500)
      throw new Error("A session needs 1 to 500 questions.");
    const id = `${this.idPrefix}-${++this.seq}`;
    const items: AttemptItem[] = input.items.map((x, position) => ({
      position,
      questionId: x.questionId,
      snapshot: x.snapshot,
      response: null,
      flagged: false,
      verdict: null,
      marks: null,
    }));
    this.attempts.set(id, {
      id,
      kind: input.kind,
      examId: input.examId,
      title: input.title,
      status: "in_progress",
      instantFeedback: input.instantFeedback,
      timeLimitSec: input.timeLimitSec,
      marksCorrect: input.marksCorrect,
      marksWrong: input.marksWrong,
      questionCount: items.length,
      score: null,
      correct: null,
      wrong: null,
      unanswered: null,
      secondsSpent: 0,
      startedAt: input.startedAt ?? this.tick(),
      submittedAt: null,
      items,
      questionIds: input.items.map((x) => x.questionId),
    });
    return id;
  }

  async get(id: string) {
    const a = this.attempts.get(id);
    return a ? structuredClone(this.strip(a)) : null;
  }

  private strip(a: Stored): AttemptWithItems {
    const { questionIds: _q, ...rest } = a;
    void _q;
    return rest;
  }

  async list(limit: number): Promise<Attempt[]> {
    return [...this.attempts.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit)
      .map((a) => {
        const { items: _i, questionIds: _q, ...head } = a;
        void _i;
        void _q;
        return structuredClone(head);
      });
  }

  async patchItem(attemptId: string, position: number, patch: ItemPatch) {
    const a = this.attempts.get(attemptId);
    if (!a || a.status === "submitted") throw new Error("This attempt is already submitted.");
    const item = a.items[position];
    if (!item) throw new Error("No such question in this attempt.");
    if ("response" in patch) item.response = patch.response ?? null;
    if (patch.flagged !== undefined) item.flagged = patch.flagged;
  }

  async submit(attemptId: string, graded: Graded[], totals: Totals) {
    const a = this.attempts.get(attemptId);
    if (!a) throw new Error("Attempt not found.");
    if (a.status === "submitted") return;
    for (const g of graded) {
      const item = a.items[g.position];
      if (item) {
        item.verdict = g.verdict;
        item.marks = g.marks;
      }
    }
    Object.assign(a, {
      status: "submitted" as const,
      submittedAt: totals.submittedAt ?? this.tick(),
      score: totals.score,
      correct: totals.correct,
      wrong: totals.wrong,
      unanswered: totals.unanswered,
      secondsSpent: totals.secondsSpent,
    });
  }

  async remove(attemptId: string) {
    this.attempts.delete(attemptId);
  }

  async facts(limit: number): Promise<Fact[]> {
    const done = [...this.attempts.values()]
      .filter((a) => a.status === "submitted")
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
    const out: Fact[] = [];
    for (const a of done) {
      for (const item of a.items) {
        if (item.verdict !== "correct" && item.verdict !== "wrong") continue;
        out.push({
          at: a.submittedAt!,
          path: item.snapshot.path,
          correct: item.verdict === "correct",
        });
      }
    }
    return out.slice(0, limit);
  }

  async past() {
    const out = new Map<string, Past>();
    const done = [...this.attempts.values()]
      .filter((a) => a.status === "submitted")
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    for (const a of done) {
      a.items.forEach((item, i) => {
        const qid = a.questionIds[i];
        if (!qid || (item.verdict !== "correct" && item.verdict !== "wrong")) return;
        const prev = out.get(qid);
        out.set(qid, { last: item.verdict, times: (prev?.times ?? 0) + 1 });
      });
    }
    return out;
  }

  async exams() {
    return [...this.examMap.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveExam(id: string | null, input: ExamInput) {
    if (input.title.trim() === "") throw new Error("Give the exam a title.");
    const key = id ?? `exam-${++this.seq}`;
    this.examMap.set(key, { ...structuredClone(input), id: key, updatedAt: this.tick() });
    return key;
  }

  async deleteExam(id: string) {
    this.examMap.delete(id);
    for (const a of this.attempts.values()) if (a.examId === id) a.examId = null;
  }
}
