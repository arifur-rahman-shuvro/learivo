import type { TaxonomyNode } from "../../question-bank/data/repo.ts";
import type { QuestionRecord, QuestionRepo } from "../../question-bank/data/repo.ts";
import { inGroup } from "../domain/groups.ts";
import { pathOf } from "../../question-bank/data/repo.ts";
import type { QuestionInput } from "../../question-bank/domain/model.ts";
import type { AttemptRepo, AttemptWithItems, Exam } from "../data/repo.ts";
import {
  applyFilter,
  composeSmart,
  composeSmartFocused,
  focusedDraw,
  drawByRules,
  shuffled,
  snapshotOf,
  type PracticeFilter,
} from "../domain/session.ts";
import { isDue } from "../../workspace/domain/scheduler.ts";
import { weakAreas } from "../../workspace/domain/insights.ts";
import type { WorkspaceRepo } from "../../workspace/data/repo.ts";
import { fetchPool, makeInside } from "./practice.tsx";
import { daysUntil, liveSubjects } from "../../workspace/domain/examTarget.ts";

/**
 * When the student has a coming exam with chosen subjects, a test that tells whether a question is
 * in those subjects. Null when there is no such exam, so nothing changes for everyone else.
 */
async function examFocus(
  workspace: WorkspaceRepo | undefined,
  nodes: readonly TaxonomyNode[],
  now: Date,
): Promise<((q: QuestionRecord) => boolean) | null> {
  if (!workspace) return null;
  const exam = await workspace.examTarget().catch(() => null);
  if (!exam?.date || !(daysUntil(exam.date, now) >= 0)) return null;
  const tops = nodes.filter((n) => n.parentId === null).map((n) => n.id);
  const chosen = liveSubjects(exam.subjectIds, tops);
  if (chosen.length === 0) return null;
  const inside = makeInside(nodes);
  return (q) => chosen.some((id) => inside(id, q));
}

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

const NO_QUESTIONS = "No questions match these choices. Change the subject or filter.";

/** Counts what a practice setup could draw, for the live hint in the form. */
export async function countAvailable(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  s: Pick<PracticeSetup, "nodeId" | "tagId" | "collectionId" | "filter">,
  workspace?: WorkspaceRepo,
): Promise<number> {
  const pool = await fetchPool(questions, s);
  if (s.filter === "all") return pool.length;
  const [past, marks, skipped] = await Promise.all([
    attempts.past(),
    workspace ? workspace.bookmarks() : Promise.resolve(new Set<string>()),
    s.filter === "skipped" ? attempts.skipped() : Promise.resolve(new Set<string>()),
  ]);
  return applyFilter(pool, s.filter, past, marks, skipped).length;
}

export async function startPractice(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  s: PracticeSetup,
  workspace?: WorkspaceRepo,
): Promise<string> {
  const [pool, nodes, past, marks, skipped] = await Promise.all([
    fetchPool(questions, s),
    questions.taxonomy(),
    s.filter === "all" ? Promise.resolve(new Map()) : attempts.past(),
    workspace && s.filter === "bookmarked"
      ? workspace.bookmarks()
      : Promise.resolve(new Set<string>()),
    s.filter === "skipped" ? attempts.skipped() : Promise.resolve(new Set<string>()),
  ]);
  const eligible = applyFilter(pool, s.filter, past, marks, skipped);
  // With no subject, tag or collection chosen, lean towards the subjects of the coming exam.
  const focus =
    s.nodeId === null && s.tagId === null && s.collectionId === null
      ? await examFocus(workspace, nodes, new Date())
      : null;
  const picked = focus
    ? focusedDraw(eligible, s.count, focus)
    : shuffled(eligible).slice(0, s.count);
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

const SMART_SIZE = 20;

/** The groups a Smart mix is drawn from: revision that is due, weak questions, new questions. */
async function smartPools(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  workspace: WorkspaceRepo,
  now: Date,
) {
  const [pool, nodes, past, cards, facts, skipped] = await Promise.all([
    fetchPool(questions, { nodeId: null, tagId: null, collectionId: null }),
    questions.taxonomy(),
    attempts.past(),
    workspace.cards(),
    attempts.facts(2000),
    attempts.skipped().catch(() => new Set<string>()),
  ]);
  const byId = new Map(pool.map((q) => [q.id, q]));
  const due = cards.filter((c) => isDue(c, now) && byId.has(c.questionId)).map((c) => c.questionId);
  const weakNames = new Set(weakAreas(facts).map((a) => a.name));
  // Weak means a weak area, a question skipped last time, or one answered sure-but-wrong or right-but-unsure.
  const weak = pool
    .filter(
      (q) =>
        weakNames.has(pathOf(q.nodeId, nodes).slice(0, 2).join(" › ")) ||
        inGroup(past.get(q.id), "overconfident") ||
        inGroup(past.get(q.id), "shaky") ||
        skipped.has(q.id),
    )
    .map((q) => q.id);
  const fresh = pool.filter((q) => !past.has(q.id)).map((q) => q.id);
  const isFocus = await examFocus(workspace, nodes, now);
  const focusIds = isFocus ? new Set(pool.filter(isFocus).map((q) => q.id)) : null;
  return { due, weak, fresh, rest: pool.map((q) => q.id), focusIds };
}

function composeFor(p: Awaited<ReturnType<typeof smartPools>>, pick?: <T>(i: readonly T[]) => T[]) {
  const { focusIds, ...pools } = p;
  return focusIds
    ? composeSmartFocused(pools, SMART_SIZE, (id) => focusIds.has(id), undefined, pick)
    : composeSmart(pools, SMART_SIZE, pick);
}

/** What a Smart mix would draw on right now, for the line under its button. */
export async function smartPreview(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  workspace: WorkspaceRepo,
  now: Date = new Date(),
): Promise<{ due: number; weak: number; fresh: number; focus: boolean }> {
  const p = await smartPools(questions, attempts, workspace, now);
  const picked = composeFor(p, (items) => [...items]);
  const set = new Set(picked);
  const within = (ids: readonly string[]) => ids.filter((id) => set.has(id)).length;
  // Counts of what is in the mix, in the order it fills: due first, then weak, then new.
  const due = within(p.due);
  const weak = within(p.weak.filter((id) => !p.due.includes(id)));
  const fresh = within(p.fresh.filter((id) => !p.due.includes(id) && !p.weak.includes(id)));
  return { due, weak, fresh, focus: p.focusIds !== null };
}

/** A session mixing due revision, weak areas and new questions. */
export async function startSmart(
  questions: QuestionRepo,
  attempts: AttemptRepo,
  workspace: WorkspaceRepo,
  now: Date = new Date(),
): Promise<string> {
  const ids = composeFor(await smartPools(questions, attempts, workspace, now));
  if (ids.length === 0) throw new Error(NO_QUESTIONS);
  return startFromQuestions(questions, attempts, ids, "Smart mix");
}
