import type { TaxonomyNode } from "../../question-bank/data/repo.ts";
import type { QuestionRepo } from "../../question-bank/data/repo.ts";
import { pathOf } from "../../question-bank/data/repo.ts";
import type { QuestionInput } from "../../question-bank/domain/model.ts";
import type { AttemptRepo, AttemptWithItems, Exam } from "../data/repo.ts";
import {
  applyFilter,
  composeSmart,
  drawByRules,
  shuffled,
  snapshotOf,
  type PracticeFilter,
} from "../domain/session.ts";
import { isDue } from "../../workspace/domain/scheduler.ts";
import { weakAreas } from "../../workspace/domain/insights.ts";
import type { WorkspaceRepo } from "../../workspace/data/repo.ts";
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
  workspace?: WorkspaceRepo,
): Promise<number> {
  const pool = await fetchPool(questions, s);
  if (s.filter === "all") return pool.length;
  const [past, marks] = await Promise.all([
    attempts.past(),
    workspace ? workspace.bookmarks() : Promise.resolve(new Set<string>()),
  ]);
  return applyFilter(pool, s.filter, past, marks).length;
}

export async function startPractice(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  s: PracticeSetup,
  workspace?: WorkspaceRepo,
): Promise<string> {
  const [pool, nodes, past, marks] = await Promise.all([
    fetchPool(questions, s),
    questions.taxonomy(),
    s.filter === "all" ? Promise.resolve(new Map()) : attempts.past(),
    workspace && s.filter === "bookmarked"
      ? workspace.bookmarks()
      : Promise.resolve(new Set<string>()),
  ]);
  const picked = shuffled(applyFilter(pool, s.filter, past, marks)).slice(0, s.count);
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

/** Finds the subject or chapter a name like "Anatomy › Heart" points at. */
export function nodeIdForName(nodes: readonly TaxonomyNode[], name: string): string | null {
  let parent: string | null = null;
  let found: TaxonomyNode | undefined;
  for (const part of name.split(" › ")) {
    found = nodes.find((n) => n.parentId === parent && n.name === part);
    if (!found) return null;
    parent = found.id;
  }
  return found?.id ?? null;
}

/** A ten-question session on one weak area, ready to play. */
export async function startForArea(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  areaName: string,
  workspace?: WorkspaceRepo,
  count = 10,
): Promise<string> {
  const nodeId = nodeIdForName(await questions.taxonomy(), areaName);
  if (!nodeId) throw new Error("That area is not in your subjects any more.");
  return startPractice(
    questions,
    attempts,
    {
      nodeId,
      tagId: null,
      collectionId: null,
      filter: "all",
      count,
      minutes: null,
      instantFeedback: true,
      shuffleOptions: true,
    },
    workspace,
  );
}

/** Draws an exam's questions by its rules without starting an attempt, for a printed paper. */
export async function drawExamPaper(questions: QuestionRepo, exam: Exam): Promise<QuestionInput[]> {
  const [pool, nodes] = await Promise.all([
    fetchPool(questions, { nodeId: null, tagId: null, collectionId: null }),
    questions.taxonomy(),
  ]);
  const drawn = drawByRules(exam.rules, pool, makeInside(nodes));
  if (drawn.length === 0) throw new Error(NO_QUESTIONS);
  return exam.randomize ? shuffled(drawn) : drawn;
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

/** A practice session from chosen questions, for example the ones the student keeps missing. */
export async function startFromQuestions(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  ids: string[],
  title: string,
): Promise<string> {
  const [records, nodes] = await Promise.all([questions.getMany(ids), questions.taxonomy()]);
  const active = records.filter((q) => q.status === "active");
  if (active.length === 0) throw new Error(NO_QUESTIONS);
  return attempts.create({
    kind: "practice",
    examId: null,
    title,
    instantFeedback: true,
    timeLimitSec: null,
    marksCorrect: 1,
    marksWrong: 0,
    items: shuffled(active)
      .slice(0, 200)
      .map((q) => ({ questionId: q.id, snapshot: snapshotOf(q, pathOf(q.nodeId, nodes), true) })),
  });
}

export const SMART_SIZE = 20;

/** A session mixing due revision, weak areas and new questions. */
export async function startSmart(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  workspace: WorkspaceRepo,
  now: Date = new Date(),
): Promise<string> {
  const [pool, nodes, past, cards, facts] = await Promise.all([
    fetchPool(questions, { nodeId: null, tagId: null, collectionId: null }),
    questions.taxonomy(),
    attempts.past(),
    workspace.cards(),
    attempts.facts(2000),
  ]);
  const byId = new Map(pool.map((q) => [q.id, q]));
  const due = cards.filter((c) => isDue(c, now) && byId.has(c.questionId)).map((c) => c.questionId);
  const weakNames = new Set(weakAreas(facts).map((a) => a.name));
  const weak = pool
    .filter((q) => weakNames.has(pathOf(q.nodeId, nodes).slice(0, 2).join(" › ")))
    .map((q) => q.id);
  const fresh = pool.filter((q) => !past.has(q.id)).map((q) => q.id);
  const ids = composeSmart({ due, weak, fresh, rest: pool.map((q) => q.id) }, SMART_SIZE);
  if (ids.length === 0) throw new Error(NO_QUESTIONS);
  return startFromQuestions(questions, attempts, ids, "Smart mix");
}
