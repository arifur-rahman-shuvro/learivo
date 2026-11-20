import {
  pathOf,
  type BulkAction,
  type QuestionRecord,
} from "../../modules/question-bank/data/repo.ts";
import type { QuestionInput } from "../../modules/question-bank/domain/model.ts";
import type { Pack } from "./pack.ts";

/**
 * Changes made to the question bank while offline. They are applied to the copy on this device at
 * once and replayed, in order, when the connection is back.
 */
export type EditOp =
  | { kind: "create"; id: string; input: QuestionInput }
  | {
      kind: "update";
      id: string;
      input: QuestionInput;
      baseVersion: number;
      /** The question as it was before the first offline edit, for the three-way comparison. */
      base?: QuestionInput;
    }
  | { kind: "bulk"; ids: string[]; action: BulkAction };

export interface FailedEdit {
  summary: string;
  message: string;
}

export const summarise = (op: EditOp): string => {
  if (op.kind === "bulk") {
    const n = op.ids.length;
    return `${op.action.kind} ${n} question${n === 1 ? "" : "s"}`;
  }
  const stem = op.input.stem.replace(/\s+/g, " ").trim();
  return `${op.kind === "create" ? "Add" : "Edit"}: ${stem.length > 70 ? `${stem.slice(0, 70)}…` : stem}`;
};

/** A saved change that has the shape the replay code expects. */
export function isEditOp(x: unknown): x is EditOp {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return false;
  const input = (v: unknown) =>
    !!v && typeof v === "object" && typeof (v as { stem?: unknown }).stem === "string";
  if (o.kind === "create") return typeof o.id === "string" && input(o.input);
  if (o.kind === "update") {
    return typeof o.id === "string" && input(o.input) && typeof o.baseVersion === "number";
  }
  if (o.kind === "bulk") {
    const a = o.action as { kind?: unknown } | null;
    return (
      Array.isArray(o.ids) &&
      o.ids.every((i) => typeof i === "string") &&
      typeof a?.kind === "string"
    );
  }
  return false;
}

/** True for a failure that a later try can fix (no connection), false for one that cannot. */
export function isTransient(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const m = e instanceof Error ? e.message : String(e);
  return /failed to fetch|network|load failed|timed? ?out|offline|connection|aborted/i.test(m);
}

/**
 * Adds an op to the queue. Several edits to one question collapse into one (keeping the version
 * the first edit started from), so replaying them is not mistaken for a clash with another device.
 */
export function enqueue(queue: EditOp[], op: EditOp): EditOp[] {
  if (op.kind !== "update") return [...queue, op];
  const at = queue.findIndex((q) => q.kind !== "bulk" && q.id === op.id);
  const had = queue[at];
  if (!had || had.kind === "bulk") return [...queue, op];
  const next = [...queue];
  next[at] =
    had.kind === "create"
      ? { kind: "create", id: had.id, input: op.input }
      : { ...op, baseVersion: had.baseVersion, base: had.base };
  return next;
}

/** The node a path of names leads to, or null when any part of it is not in the copy yet. */
function nodeFor(pack: Pack, path: string[]): string | null {
  if (path.length === 0) return null;
  let parent: string | null = null;
  for (const name of path) {
    const hit = pack.taxonomy.find(
      (n) => n.parentId === parent && n.name.toLowerCase() === name.toLowerCase(),
    );
    if (!hit) return null;
    parent = hit.id;
  }
  return parent;
}

function tagIdsFor(pack: Pack, names: string[]): string[] {
  const want = new Set(names.map((n) => n.toLowerCase()));
  return pack.tags.filter((t) => want.has(t.name.toLowerCase())).map((t) => t.id);
}

function bump<T extends { id: string; count: number }>(list: T[], id: string, by: number) {
  const x = list.find((i) => i.id === id);
  if (x) x.count = Math.max(0, x.count + by);
}

/** Applies an op to the copy on this device, the way the database will once it is sent. */
export function applyEdit(pack: Pack, op: EditOp, now: () => Date = () => new Date()): void {
  const at = now().toISOString();
  if (op.kind === "create") {
    if (pack.questions.some((q) => q.id === op.id)) return; // already laid over this copy
    const rec: QuestionRecord = {
      ...structuredClone(op.input),
      id: op.id,
      status: "active",
      version: 1,
      createdAt: at,
      updatedAt: at,
      nodeId: nodeFor(pack, op.input.path),
      tagIds: tagIdsFor(pack, op.input.tags),
      collectionIds: [],
    };
    pack.questions.unshift(rec);
    return;
  }
  if (op.kind === "update") {
    const i = pack.questions.findIndex((q) => q.id === op.id);
    const cur = pack.questions[i];
    if (!cur) return;
    pack.questions[i] = {
      ...structuredClone(op.input),
      id: cur.id,
      status: cur.status,
      version: cur.version,
      createdAt: cur.createdAt,
      updatedAt: at,
      nodeId: nodeFor(pack, op.input.path),
      tagIds: tagIdsFor(pack, op.input.tags),
      collectionIds: cur.collectionIds,
    };
    return;
  }
  const ids = new Set(op.ids);
  const a = op.action;
  if (a.kind === "archive" || a.kind === "delete") {
    // The copy holds active questions only.
    pack.questions = pack.questions.filter((q) => !ids.has(q.id));
    return;
  }
  for (const q of pack.questions) {
    if (!ids.has(q.id)) continue;
    q.updatedAt = at;
    if (a.kind === "classify") {
      q.nodeId = a.nodeId;
      q.path = pathOf(a.nodeId, pack.taxonomy);
    } else if (a.kind === "tag") {
      const has = q.tagIds.includes(a.tagId);
      const name = pack.tags.find((t) => t.id === a.tagId)?.name;
      if (a.add && !has) {
        q.tagIds.push(a.tagId);
        if (name) q.tags = [...q.tags, name];
        bump(pack.tags, a.tagId, 1);
      } else if (!a.add && has) {
        q.tagIds = q.tagIds.filter((t) => t !== a.tagId);
        if (name) q.tags = q.tags.filter((t) => t.toLowerCase() !== name.toLowerCase());
        bump(pack.tags, a.tagId, -1);
      }
    } else if (a.kind === "collection") {
      const has = q.collectionIds.includes(a.collectionId);
      if (a.add && !has) {
        q.collectionIds.push(a.collectionId);
        bump(pack.collections, a.collectionId, 1);
      } else if (!a.add && has) {
        q.collectionIds = q.collectionIds.filter((c) => c !== a.collectionId);
        bump(pack.collections, a.collectionId, -1);
      }
    }
  }
}
