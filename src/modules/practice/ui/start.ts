import type { QuestionRepo } from "../../question-bank/data/repo.ts";
import { pathOf } from "../../question-bank/data/repo.ts";
import type { AttemptRepo, AttemptWithItems, Exam } from "../data/repo.ts";
import {
  applyFilter,
  drawByRules,
  shuffled,
  snapshotOf,
  type PracticeFilter,
} from "../domain/session.ts";
import { fetchPool, makeInside } from "./practice.tsx";

export interface PracticeSetup {
  nodeId: string | null;
  tagId: string | null;
  collectionId: string | null;
  filter: PracticeFilter;
  count: number;
  /** Minutes, or null for untimed. */
  minutes: number | null;
  instantFeedback: boolean;
  shuffleOptions: boolean;
}

export const NO_QUESTIONS = "No questions match these choices. Change the subject or filter.";

/** Counts what a practice setup could draw, for the live hint in the form. */
export async function countAvailable(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  s: Pick<PracticeSetup, "nodeId" | "tagId" | "collectionId" | "filter">,
): Promise<number> {
  const pool = await fetchPool(questions, s);
  if (s.filter === "all") return pool.length;
  return applyFilter(pool, s.filter, await attempts.past()).length;
}

export async function startPractice(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  s: PracticeSetup,
): Promise<string> {
  const [pool, nodes, past] = await Promise.all([
    fetchPool(questions, s),
    questions.taxonomy(),
    s.filter === "all" ? Promise.resolve(new Map()) : attempts.past(),
  ]);
  const picked = shuffled(applyFilter(pool, s.filter, past)).slice(0, s.count);
  if (picked.length === 0) throw new Error(NO_QUESTIONS);
  return attempts.create({
    kind: "practice",
    examId: null,
    title: "Practice session",
    instantFeedback: s.instantFeedback,
    timeLimitSec: s.minutes === null ? null : Math.round(s.minutes * 60),
    marksCorrect: 1,
    marksWrong: 0,
    items: picked.map((q) => ({
      questionId: q.id,
      snapshot: snapshotOf(q, pathOf(q.nodeId, nodes), s.shuffleOptions),
    })),
  });
}

export async function startExam(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  exam: Exam,
): Promise<string> {
  const [pool, nodes] = await Promise.all([
    fetchPool(questions, { nodeId: null, tagId: null, collectionId: null }),
    questions.taxonomy(),
  ]);
  const drawn = drawByRules(exam.rules, pool, makeInside(nodes));
  if (drawn.length === 0) throw new Error(NO_QUESTIONS);
  const order = exam.randomize ? shuffled(drawn) : drawn;
  return attempts.create({
    kind: "exam",
    examId: exam.id,
    title: exam.title,
    instantFeedback: false,
    timeLimitSec: exam.timeLimitSec,
    marksCorrect: exam.marksCorrect,
    marksWrong: exam.marksWrong,
    items: order.map((q) => ({
      questionId: q.id,
      snapshot: snapshotOf(q, pathOf(q.nodeId, nodes), exam.randomize),
    })),
  });
}

/** A new practice session from the questions the student missed or skipped. */
export async function startRetry(attempts: AttemptRepo, from: AttemptWithItems): Promise<string> {
  const items = from.items.filter((i) => i.verdict !== "correct" && i.questionId !== null);
  if (items.length === 0) throw new Error("Nothing to retry: every question was correct.");
  return attempts.create({
    kind: "practice",
    examId: null,
    title: "Retry: missed questions",
    instantFeedback: true,
    timeLimitSec: null,
    marksCorrect: 1,
    marksWrong: 0,
    items: shuffled(items).map((i) => ({ questionId: i.questionId!, snapshot: i.snapshot })),
  });
}
