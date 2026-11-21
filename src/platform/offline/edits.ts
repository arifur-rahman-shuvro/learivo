import {
  KIND_BY_DEPTH,
  pathOf,
  subtreeIds,
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
  | { kind: "bulk"; ids: string[]; action: BulkAction }
  | OrganizeOp;

/**
 * A change to the lists that organise questions: subjects (and chapters), tags and collections.
 * A new item gets an id made on this device; it is swapped for the real one when it is sent, and
 * later changes that mention it are sent with the real id.
 */
export interface OrganizeOp {
  kind: "organize";
  what: "node" | "tag" | "collection";
  act: "add" | "rename" | "delete" | "merge" | "color";
  id: string;
  /** The item's name when the change was made, for the list of waiting changes. */
  label: string;
  name?: string;
  parentId?: string | null;
  /** merge: the item that takes over the questions of `id`. */
  into?: string;
  color?: string | null;
}

const WHAT = { node: "subject", tag: "tag", collection: "collection" } as const;

export interface FailedEdit {
  summary: string;
  message: string;
}

export const summarise = (op: EditOp): string => {
  if (op.kind === "organize") {
    const w = WHAT[op.what];
    const n = op.name ? `: ${op.name}` : op.label ? `: ${op.label}` : "";
    return op.act === "add"
      ? `Add ${w}${n}`
      : op.act === "rename"
        ? `Rename ${w} ${op.label} to ${op.name ?? ""}`
        : op.act === "color"
          ? `Colour ${w}${n}`
          : op.act === "merge"
            ? `Merge ${w}${n}`
            : `Delete ${w}${n}`;
  }
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
  if (o.kind === "organize") {
    return (
      (o.what === "node" || o.what === "tag" || o.what === "collection") &&
      ["add", "rename", "delete", "merge", "color"].includes(o.act as string) &&
      typeof o.id === "string" &&
      typeof o.label === "string"
    );
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
  const at = queue.findIndex((q) => (q.kind === "create" || q.kind === "update") && q.id === op.id);
  const had = queue[at];
  if (!had || (had.kind !== "create" && had.kind !== "update")) return [...queue, op];
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
  if (op.kind === "organize") {
    applyOrganize(pack, op);
    return;
  }
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

/** Lays an organising change over the copy on this device. */
function applyOrganize(pack: Pack, op: OrganizeOp): void {
  const list =
    op.what === "node" ? pack.taxonomy : op.what === "tag" ? pack.tags : pack.collections;
  const has = (id: string) => list.some((x) => x.id === id);
  const lower = (t: string) => t.trim().toLowerCase();

  if (op.act === "add") {
    if (has(op.id)) return; // already laid over this copy
    const name = (op.name ?? "").trim();
    if (op.what === "node") {
      const parent = op.parentId ? pack.taxonomy.find((n) => n.id === op.parentId) : null;
      if (op.parentId && !parent) throw new Error("The parent no longer exists.");
      const depth = parent ? KIND_BY_DEPTH.indexOf(parent.kind) + 1 : 0;
      if (depth > 3) throw new Error("A subtopic cannot have children.");
      if (
        pack.taxonomy.some(
          (n) => n.parentId === (op.parentId ?? null) && lower(n.name) === lower(name),
        )
      )
        throw new Error("That name is already used here.");
      pack.taxonomy.push({
        id: op.id,
        parentId: op.parentId ?? null,
        kind: KIND_BY_DEPTH[depth]!,
        name,
        position: 0,
        color: null,
      });
    } else {
      const items = list as { name: string }[];
      if (items.some((x) => lower(x.name) === lower(name)))
        throw new Error("That name is already used.");
      (list as { id: string; name: string; count: number }[]).push({ id: op.id, name, count: 0 });
    }
    return;
  }
  if (!has(op.id)) return; // gone already, or never reached this copy

  if (op.act === "rename") {
    const name = (op.name ?? "").trim();
    const item = list.find((x) => x.id === op.id) as { name: string };
    const old = item.name;
    item.name = name;
    if (op.what === "node") {
      for (const q of pack.questions) q.path = pathOf(q.nodeId, pack.taxonomy);
    } else if (op.what === "tag") {
      for (const q of pack.questions)
        if (q.tagIds.includes(op.id))
          q.tags = q.tags.map((t) => (lower(t) === lower(old) ? name : t));
    }
    return;
  }
  if (op.act === "color") {
    const n = pack.taxonomy.find((x) => x.id === op.id);
    if (n) n.color = op.color ?? null;
    return;
  }
  if (op.act === "merge") {
    const into = op.into
      ? (list as { id: string; name: string; count?: number }[]).find((x) => x.id === op.into)
      : undefined;
    if (!into) return;
    const from = (list as { id: string; name: string; count: number }[]).find(
      (x) => x.id === op.id,
    )!;
    for (const q of pack.questions) {
      if (op.what === "tag" && q.tagIds.includes(op.id)) {
        q.tagIds = [...new Set(q.tagIds.map((t) => (t === op.id ? into.id : t)))];
        q.tags = [...new Set(q.tags.map((t) => (lower(t) === lower(from.name) ? into.name : t)))];
      } else if (op.what === "collection" && q.collectionIds.includes(op.id)) {
        q.collectionIds = [...new Set(q.collectionIds.map((c) => (c === op.id ? into.id : c)))];
      }
    }
    into.count = (into.count ?? 0) + from.count;
  }
  // delete (and the tail of merge): remove the item and whatever points at it.
  if (op.what === "node") {
    const gone = new Set(subtreeIds(op.id, pack.taxonomy));
    pack.taxonomy = pack.taxonomy.filter((n) => !gone.has(n.id));
    for (const q of pack.questions)
      if (q.nodeId && gone.has(q.nodeId)) {
        q.nodeId = null;
        q.path = [];
      }
  } else if (op.what === "tag") {
    const name = (pack.tags.find((t) => t.id === op.id)?.name ?? "").toLowerCase();
    pack.tags = pack.tags.filter((t) => t.id !== op.id);
    for (const q of pack.questions)
      if (q.tagIds.includes(op.id) && op.act === "delete") {
        q.tagIds = q.tagIds.filter((t) => t !== op.id);
        q.tags = q.tags.filter((t) => lower(t) !== name);
      }
  } else {
    pack.collections = pack.collections.filter((c) => c.id !== op.id);
    for (const q of pack.questions)
      if (op.act === "delete") q.collectionIds = q.collectionIds.filter((c) => c !== op.id);
  }
}
