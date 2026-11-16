import type { Snapshot, Response, Verdict } from "../domain/grading.ts";
import type { Reason } from "../domain/reasons.ts";
import type { ExamRule, Past } from "../domain/session.ts";
import type { Fact } from "../../workspace/domain/insights.ts";

export interface Exam {
  id: string;
  title: string;
  instructions: string;
  timeLimitSec: number | null;
  marksCorrect: number;
  marksWrong: number;
  randomize: boolean;
  rules: ExamRule[];
  updatedAt: string;
}

export type ExamInput = Omit<Exam, "id" | "updatedAt">;

export interface AttemptItem {
  position: number;
  /** The bank question this was drawn from; null once that question is deleted. */
  questionId: string | null;
  snapshot: Snapshot;
  response: Response | null;
  flagged: boolean;
  /** The student's own reason for missing it; set after the session. */
  mistakeReason: Reason | null;
  verdict: Verdict | null;
  /** Share of full credit earned, 0 to 1. */
  credit: number | null;
  marks: number | null;
}

export interface Attempt {
  id: string;
  kind: "practice" | "exam";
  examId: string | null;
  title: string;
  status: "in_progress" | "submitted";
  instantFeedback: boolean;
  timeLimitSec: number | null;
  marksCorrect: number;
  marksWrong: number;
  questionCount: number;
  score: number | null;
  correct: number | null;
  partial: number | null;
  wrong: number | null;
  unanswered: number | null;
  secondsSpent: number;
  startedAt: string;
  submittedAt: string | null;
}

export interface AttemptWithItems extends Attempt {
  items: AttemptItem[];
}

export interface NewAttempt {
  kind: "practice" | "exam";
  examId: string | null;
  title: string;
  instantFeedback: boolean;
  timeLimitSec: number | null;
  marksCorrect: number;
  marksWrong: number;
  /** Set when a session started offline and is recorded later; defaults to now. */
  startedAt?: string;
  /** Each item carries the question it came from, so the history can be recorded. */
  items: { questionId: string; snapshot: Snapshot }[];
}

export interface ItemPatch {
  response?: Response | null;
  flagged?: boolean;
  /** Can be set after the attempt is submitted. */
  mistakeReason?: Reason | null;
}

/** One graded answer, written when an attempt is submitted. */
export interface Graded {
  position: number;
  verdict: Verdict;
  credit: number;
  marks: number;
}

export interface Totals {
  score: number;
  correct: number;
  partial: number;
  wrong: number;
  unanswered: number;
  secondsSpent: number;
  /** Set when a session finished offline and is recorded later; defaults to now. */
  submittedAt?: string;
}

export interface AttemptRepo {
  create(input: NewAttempt): Promise<string>;
  get(id: string): Promise<AttemptWithItems | null>;
  /** Newest first. */
  list(limit: number): Promise<Attempt[]>;
  patchItem(attemptId: string, position: number, patch: ItemPatch): Promise<void>;
  /** Writes the grades and totals and marks the attempt as submitted. */
  submit(attemptId: string, graded: Graded[], totals: Totals): Promise<void>;
  remove(attemptId: string): Promise<void>;

  /** Every answered question from finished sessions, newest first, up to `limit`. */
  facts(limit: number): Promise<Fact[]>;

  /** Result of the latest graded answer for each question that was ever answered. */
  past(): Promise<Map<string, Past>>;

  exams(): Promise<Exam[]>;
  saveExam(id: string | null, input: ExamInput): Promise<string>;
  deleteExam(id: string): Promise<void>;
}
