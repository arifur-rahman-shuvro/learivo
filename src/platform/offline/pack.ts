import { reportError } from "../../core/monitoring.ts";
import { contentHash } from "../../modules/question-bank/domain/hash.ts";
import type { QuestionInput } from "../../modules/question-bank/domain/model.ts";
import {
  DEFAULT_QUERY,
  KIND_BY_DEPTH,
  subtreeIds,
  type Collection,
  type Page,
  type QuestionQuery,
  type QuestionRecord,
  type QuestionRepo,
  type QuestionVersion,
  type Tag,
  type TaxonomyNode,
} from "../../modules/question-bank/data/repo.ts";
import type { KeyValueStore } from "./store.ts";
import {
  applyEdit,
  enqueue,
  isEditOp,
  isTransient,
  summarise,
  type EditOp,
  type FailedEdit,
  type OrganizeOp,
} from "./edits.ts";
import { questionToRecord } from "../../modules/question-bank/domain/importExport.ts";
import {
  applyChoices,
  inputOf,
  threeWay,
  type Conflict,
  type ResolvedConflict,
  type Side,
} from "./merge.ts";

/** A copy of the active question bank kept on this device so practice works without internet. */
export interface Pack {
  savedAt: string;
  questions: QuestionRecord[];
  taxonomy: TaxonomyNode[];
  tags: Tag[];
  collections: Collection[];
}

export const OFFLINE_MESSAGE = "You are offline, and this copy of your questions can only be read.";
export const NO_COPY_MESSAGE =
  "You are offline and there is no copy of your questions on this device. Download the copy while online to edit offline.";

/** Reads every active question and the lists that go with them. */
const PACK_PAGE = 500;

export async function buildPack(repo: QuestionRepo, now = () => new Date()): Promise<Pack> {
  const questions: QuestionRecord[] = [];
  // Every question, however many: a copy that silently stopped short would look complete offline.
  for (let offset = 0; ; offset += PACK_PAGE) {
    const page = await repo.list({ ...DEFAULT_QUERY, status: "active", offset, limit: PACK_PAGE });
    questions.push(...page.items);
    if (questions.length >= page.total || page.items.length === 0) break;
  }
  const [taxonomy, tags, collections] = await Promise.all([
    repo.taxonomy(),
    repo.tags(),
    repo.collections(),
  ]);
  return { savedAt: now().toISOString(), questions, taxonomy, tags, collections };
}

/** Read-only question bank backed by a pack. Anything that changes the bank is refused. */
export class PackRepo implements QuestionRepo {
  constructor(private readonly pack: Pack) {}

  private refuse(): never {
    throw new Error(OFFLINE_MESSAGE);
  }

  async list(q: QuestionQuery): Promise<Page<QuestionRecord>> {
    const words = q.search.toLowerCase().split(/\s+/).filter(Boolean);
    const within = q.nodeId ? new Set(subtreeIds(q.nodeId, this.pack.taxonomy)) : null;
    // The pack only holds active questions.
    let items = q.status === "archived" ? [] : this.pack.questions;
    items = items.filter((r) => {
      if (within && !(r.nodeId && within.has(r.nodeId))) return false;
      if (q.unclassified && r.nodeId) return false;
      if (q.qtypes.length && !q.qtypes.includes(r.qtype)) return false;
      if (q.difficulties.length && !(r.difficulty && q.difficulties.includes(r.difficulty)))
        return false;
      if (q.tagId && !r.tagIds.includes(q.tagId)) return false;
      if (q.collectionId && !r.collectionIds.includes(q.collectionId)) return false;
      const hay = `${r.stem} ${r.explanation}`.toLowerCase();
      const tokens = hay.split(/[^\p{L}\p{N}]+/u);
      return words.every((w) => tokens.some((t) => t.startsWith(w)));
    });
    items = [...items].sort((a, b) =>
      q.sort === "stem"
        ? a.stem.localeCompare(b.stem)
        : q.sort === "created"
          ? b.createdAt.localeCompare(a.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
    return {
      total: items.length,
      items: structuredClone(items.slice(q.offset, q.offset + q.limit)),
    };
  }

  async get(id: string) {
    const r = this.pack.questions.find((x) => x.id === id);
    return r ? structuredClone(r) : null;
  }
  async getMany(ids: string[]) {
    const want = new Set(ids);
    return structuredClone(this.pack.questions.filter((x) => want.has(x.id)));
  }
  async versions(): Promise<QuestionVersion[]> {
    return [];
  }
  async hashes() {
    return new Set(this.pack.questions.map((r) => contentHash(r.stem, r.qtype)));
  }
  async exportAll(): Promise<QuestionInput[]> {
    return structuredClone(this.pack.questions).map((r) => {
      const { id: _a, status: _b, version: _c, createdAt: _d, updatedAt: _e, ...rest } = r;
      void [_a, _b, _c, _d, _e];
      const { nodeId: _n, tagIds: _t, collectionIds: _co, ...input } = rest;
      void [_n, _t, _co];
      return input;
    });
  }
  async taxonomy() {
    return structuredClone(this.pack.taxonomy);
  }
  async tags() {
    return structuredClone(this.pack.tags);
  }
  async collections() {
    return structuredClone(this.pack.collections);
  }

  create = async () => this.refuse();
  update = async () => this.refuse();
  bulk = async () => this.refuse();
  addNode = async () => this.refuse();
  renameNode = async () => this.refuse();
  setNodeColor = async () => this.refuse();
  deleteNode = async () => this.refuse();
  addTag = async () => this.refuse();
  renameTag = async () => this.refuse();
  deleteTag = async () => this.refuse();
  mergeTags = async () => this.refuse();
  mergeCollections = async () => this.refuse();
  addCollection = async () => this.refuse();
  renameCollection = async () => this.refuse();
  deleteCollection = async () => this.refuse();
}

const packKey = (userId: string) => `u:${userId}:pack`;
const enabledKey = (userId: string) => `u:${userId}:pack-enabled`;

export interface PackStatus {
  enabled: boolean;
  savedAt: string | null;
  count: number;
  /** Changes made offline that are not in the database yet. */
  waiting: number;
  /** Changes the database refused, kept so the student can see what was not saved. */
  failed: FailedEdit[];
  /** Offline edits that clash with a change made elsewhere and wait for a decision. */
  conflicts: Conflict[];
  /** The most recent decisions, kept so an older version can be brought back. */
  resolved: ResolvedConflict[];
}

/** Thrown instead of wiping the device while changes made offline are still unsent. */
export class UnsentChangesError extends Error {
  constructor(readonly summaries: string[]) {
    super(`${summaries.length} change${summaries.length === 1 ? " is" : "s are"} not sent yet.`);
  }
}

export interface FlushReport {
  sent: number;
  /** Edits that were combined with a change made elsewhere because they touched different parts. */
  merged: number;
  /** Edits that clash with another change, or with a deletion, and wait for a decision. */
  conflicts: number;
  failed: number;
}

const editsKey = (userId: string) => `u:${userId}:edits`;
const idMapKey = (userId: string) => `u:${userId}:idmap`;
const failedKey = (userId: string) => `u:${userId}:edits-failed`;
const conflictsKey = (userId: string) => `u:${userId}:conflicts`;
const resolvedKey = (userId: string) => `u:${userId}:conflicts-resolved`;
const KEEP_RESOLVED = 20;

/**
 * The question bank as the app sees it: the live one when there is a connection, the pack when
 * there is not. Reading keeps the pack fresh; changes always go to the live bank.
 */
export class OfflineAwareRepo implements QuestionRepo {
  private pack: Pack | null = null;
  private loaded = false;
  private enabled = true;
  private listeners = new Set<() => void>();
  private flushedListeners = new Set<(r: FlushReport) => void>();
  private queue: EditOp[] = [];
  private failed: FailedEdit[] = [];
  private conflicts: Conflict[] = [];
  private resolved: ResolvedConflict[] = [];
  private flushing?: Promise<FlushReport>;
  /** Ids made on this device for new subjects, tags and collections, and the real ones they became. */
  private idMap: Record<string, string> = {};

  constructor(
    private readonly remote: QuestionRepo,
    private readonly store: KeyValueStore,
    private readonly userId: string,
    private readonly isOnline: () => boolean = () => navigator.onLine,
  ) {}

  private async load() {
    if (this.loaded) return;
    this.pack = (await this.store.get<Pack>(packKey(this.userId))) ?? null;
    this.enabled = (await this.store.get<boolean>(enabledKey(this.userId))) ?? true;
    const saved = await this.store.get<unknown>(editsKey(this.userId));
    const rows = Array.isArray(saved) ? saved : [];
    this.queue = rows.filter(isEditOp).filter((op) => {
      // A saved change that cannot even be laid over the copy is unreadable: set it aside.
      try {
        if (this.pack) applyEdit(this.pack, op);
        return true;
      } catch {
        return false;
      }
    });
    const ids = await this.store.get<Record<string, string>>(idMapKey(this.userId));
    this.idMap = ids && typeof ids === "object" ? ids : {};
    this.failed = (await this.store.get<FailedEdit[]>(failedKey(this.userId))) ?? [];
    const cs = await this.store.get<unknown>(conflictsKey(this.userId));
    this.conflicts = Array.isArray(cs) ? (cs as Conflict[]).filter((c) => c && c.mine && c.id) : [];
    const rs = await this.store.get<unknown>(resolvedKey(this.userId));
    this.resolved = Array.isArray(rs) ? (rs as ResolvedConflict[]).filter((r) => r?.conflict) : [];
    // The stored copy never includes changes that are still waiting (writing the whole copy after
    // every edit would stall a large bank), so they are laid over it each time it is loaded.
    if (saved !== undefined && (!Array.isArray(saved) || this.queue.length < rows.length)) {
      // Never replay something unreadable; say so instead of failing silently.
      const lost = Array.isArray(saved) ? rows.length - this.queue.length : 1;
      this.failed.push({
        summary: `${lost} saved change${lost === 1 ? "" : "s"}`,
        message: "could not be read and were set aside.",
      });
      await this.store.set(editsKey(this.userId), this.queue);
      await this.store.set(failedKey(this.userId), this.failed);
      reportError(new Error("Saved offline changes could not be read"));
    }
    this.loaded = true;
  }

  /** Called after waiting changes have been sent, so screens can reload. */
  onFlushed(fn: (r: FlushReport) => void) {
    this.flushedListeners.add(fn);
    return () => void this.flushedListeners.delete(fn);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private changed() {
    this.listeners.forEach((l) => l());
  }

  async status(): Promise<PackStatus> {
    await this.load();
    return {
      enabled: this.enabled,
      savedAt: this.pack?.savedAt ?? null,
      count: this.pack?.questions.length ?? 0,
      waiting: this.queue.length,
      failed: [...this.failed],
      conflicts: [...this.conflicts],
      resolved: [...this.resolved],
    };
  }

  /** Downloads the whole bank to this device. */
  async download(): Promise<PackStatus> {
    await this.load();
    if (this.queue.length > 0) {
      // Replacing the copy now would throw away changes the database has not received.
      await this.flushEdits();
      if (this.queue.length > 0) {
        throw new Error(
          "Some changes are still waiting to be sent. Try again when you are online.",
        );
      }
      return this.status();
    }
    const pack = await buildPack(this.remote);
    await this.store.set(packKey(this.userId), pack);
    await this.store.set(enabledKey(this.userId), true);
    this.pack = pack;
    this.enabled = true;
    this.changed();
    return this.status();
  }

  /** Removes the copy from this device and stops keeping one. */
  async remove(): Promise<PackStatus> {
    await this.load();
    if (this.queue.length > 0) {
      throw new Error("Changes made offline are still waiting to be sent. Connect and sync first.");
    }
    await this.store.del(packKey(this.userId));
    await this.store.set(enabledKey(this.userId), false);
    this.pack = null;
    this.enabled = false;
    this.changed();
    return this.status();
  }

  /** Refreshes the copy, when the student keeps one and a connection exists. */
  async refresh(): Promise<void> {
    await this.load();
    if (!this.isOnline()) return;
    if (this.queue.length > 0) await this.flushEdits();
    else if (this.enabled) await this.download();
  }

  /** Online: the live bank. Offline, or the live bank cannot be reached: the pack. */
  private async readOffline<T>(live: () => Promise<T>, local: (p: PackRepo) => Promise<T>) {
    await this.load();
    // While changes wait to be sent the database is behind the copy, so read the copy.
    if ((!this.isOnline() || this.queue.length > 0) && this.pack) {
      return local(new PackRepo(this.pack));
    }
    try {
      return await live();
    } catch (e) {
      // A connection that says "online" but does not work looks the same: use the copy.
      if (this.pack) return local(new PackRepo(this.pack));
      throw e;
    }
  }

  list = (q: QuestionQuery) =>
    this.readOffline(
      () => this.remote.list(q),
      (p) => p.list(q),
    );
  get = (id: string) =>
    this.readOffline(
      () => this.remote.get(id),
      (p) => p.get(id),
    );
  getMany = (ids: string[]) =>
    this.readOffline(
      () => this.remote.getMany(ids),
      (p) => p.getMany(ids),
    );
  versions = (id: string) => this.remote.versions(id);
  hashes = () =>
    this.readOffline(
      () => this.remote.hashes(),
      (p) => p.hashes(),
    );
  exportAll = () =>
    this.readOffline(
      () => this.remote.exportAll(),
      (p) => p.exportAll(),
    );
  taxonomy = () =>
    this.readOffline(
      () => this.remote.taxonomy(),
      (p) => p.taxonomy(),
    );
  tags = () =>
    this.readOffline(
      () => this.remote.tags(),
      (p) => p.tags(),
    );
  collections = () =>
    this.readOffline(
      () => this.remote.collections(),
      (p) => p.collections(),
    );

  /**
   * Adding, editing, archiving, tagging and moving questions: sent straight away when online,
   * otherwise saved on this device and sent later, in order.
   */
  private async edit<T>(ops: EditOp[], direct: () => Promise<T>, result: T): Promise<T> {
    await this.load();
    if (this.isOnline() && this.queue.length === 0) {
      try {
        return await direct();
      } catch (e) {
        // "Online" but the request never arrived: keep the change instead of losing it.
        if (!isTransient(e) || !this.pack) throw e;
      }
    }
    if (!this.pack) throw new Error(NO_COPY_MESSAGE);
    for (const op of ops) {
      this.queue = enqueue(this.queue, op);
      applyEdit(this.pack, op);
    }
    // Only the short list of waiting changes is saved; the stored copy stays as the account had it.
    await this.store.set(editsKey(this.userId), this.queue);
    this.changed();
    if (this.isOnline()) void this.flushEdits().catch(() => undefined);
    return result;
  }

  create = (inputs: QuestionInput[], chosen?: string[]) => {
    const ids = inputs.map((_, i) => chosen?.[i] ?? crypto.randomUUID());
    // One queued change per question, so a retry can skip the ones that already arrived.
    const ops = inputs.map((input, i): EditOp => ({ kind: "create", id: ids[i]!, input }));
    return this.edit(ops, () => this.remote.create(inputs, ids), ids);
  };

  update = async (id: string, input: QuestionInput) => {
    await this.load();
    const base = this.pack?.questions.find((q) => q.id === id)?.version ?? 0;
    const pending = this.queue.find((q) => q.kind === "update" && q.id === id);
    const baseVersion = pending?.kind === "update" ? pending.baseVersion : base;
    const was = this.pack?.questions.find((q) => q.id === id);
    const start = pending?.kind === "update" ? pending.base : was ? inputOf(was) : undefined;
    await this.edit(
      [{ kind: "update", id, input, baseVersion, ...(start ? { base: start } : {}) }],
      () => this.remote.update(id, input),
      undefined,
    );
  };

  bulk: QuestionRepo["bulk"] = (ids, action) =>
    this.edit([{ kind: "bulk", ids, action }], () => this.remote.bulk(ids, action), undefined);

  /** Sends changes made offline, in order. Stops at the first connection problem and tries again later. */
  flushEdits(): Promise<FlushReport> {
    this.flushing ??= this.runFlush().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  private async runFlush(): Promise<FlushReport> {
    await this.load();
    const report: FlushReport = { sent: 0, merged: 0, conflicts: 0, failed: 0 };
    let touched = false;
    while (this.queue.length > 0 && this.isOnline()) {
      const op = this.queue[0]!;
      try {
        await this.replay(op, report);
      } catch (e) {
        if (isTransient(e)) break;
        this.failed.push({
          summary: summarise(op),
          message: e instanceof Error ? e.message : "The database refused this change.",
        });
        report.failed += 1;
        // Only the kind of change is reported, never its text or the database's message.
        reportError(new Error(`Offline change refused (${op.kind})`));
      }
      touched = true;
      this.queue.shift();
      await this.store.set(editsKey(this.userId), this.queue);
      await this.store.set(failedKey(this.userId), this.failed);
      await this.store.set(conflictsKey(this.userId), this.conflicts);
      this.changed();
    }
    if (touched && this.queue.length === 0 && Object.keys(this.idMap).length > 0) {
      this.idMap = {}; // every waiting change has been sent: the swaps are no longer needed
      await this.store.del(idMapKey(this.userId));
    }
    if (touched && this.queue.length === 0 && this.enabled) {
      await this.download().catch(() => undefined);
    }
    if (touched) this.flushedListeners.forEach((l) => l(report));
    return report;
  }

  private async replay(op: EditOp, report: FlushReport) {
    if (op.kind === "create") {
      if ((await this.remote.getMany([op.id])).length === 0) {
        await this.remote.create([op.input], [op.id]);
      }
    } else if (op.kind === "update") {
      const cur = await this.remote.get(op.id);
      if (!cur) {
        // Deleted elsewhere: the student decides whether the edit brings it back.
        this.holdConflict(report, {
          id: op.id,
          kind: "deleted",
          base: op.base ?? null,
          mine: op.input,
          theirs: null,
          clashes: [],
          at: new Date().toISOString(),
        });
        return;
      }
      let input = op.input;
      if (cur.version !== op.baseVersion) {
        // Changed elsewhere too: combine what does not overlap, ask about what does.
        const theirs = inputOf(cur);
        const { merged, clashes } = threeWay(op.base ?? null, op.input, theirs);
        if (clashes.length > 0) {
          this.holdConflict(report, {
            id: op.id,
            kind: "edited",
            base: op.base ?? null,
            mine: op.input,
            theirs,
            clashes,
            at: new Date().toISOString(),
          });
          return;
        }
        input = merged;
        report.merged += 1;
      }
      await this.remote.update(op.id, input);
    } else if (op.kind === "organize") {
      await this.replayOrganize(op);
    } else {
      const a = op.action;
      const real = (id: string) => this.idMap[id] ?? id;
      await this.remote.bulk(
        op.ids,
        a.kind === "classify"
          ? { ...a, nodeId: a.nodeId ? real(a.nodeId) : a.nodeId }
          : a.kind === "tag"
            ? { ...a, tagId: real(a.tagId) }
            : a.kind === "collection"
              ? { ...a, collectionId: real(a.collectionId) }
              : a,
      );
    }
    report.sent += 1;
  }

  /** Sends one change to subjects, tags or collections, swapping ids made here for the real ones. */
  private async replayOrganize(op: OrganizeOp) {
    const real = (id: string) => this.idMap[id] ?? id;
    const r = this.remote;
    const id = real(op.id);
    const name = op.name ?? "";
    if (op.act === "add") {
      if (this.idMap[op.id]) return; // sent before a connection dropped
      let made: string;
      if (op.what === "node") {
        const parent = op.parentId ? real(op.parentId) : null;
        const same = (await r.taxonomy()).find(
          (n) => n.parentId === parent && n.name.toLowerCase() === name.toLowerCase(),
        );
        made = same ? same.id : (await r.addNode(parent, name)).id;
      } else if (op.what === "tag") {
        const same = (await r.tags()).find((t) => t.name.toLowerCase() === name.toLowerCase());
        made = same ? same.id : (await r.addTag(name)).id;
      } else {
        const same = (await r.collections()).find(
          (c) => c.name.toLowerCase() === name.toLowerCase(),
        );
        made = same ? same.id : (await r.addCollection(name)).id;
      }
      this.idMap[op.id] = made;
      await this.store.set(idMapKey(this.userId), this.idMap);
      return;
    }
    const into = op.into ? real(op.into) : "";
    if (op.what === "node") {
      if (op.act === "rename") await r.renameNode(id, name);
      else if (op.act === "color") await r.setNodeColor(id, op.color ?? null);
      else await r.deleteNode(id);
    } else if (op.what === "tag") {
      if (op.act === "rename") await r.renameTag(id, name);
      else if (op.act === "merge") await r.mergeTags(id, into);
      else await r.deleteTag(id);
    } else if (op.act === "rename") await r.renameCollection(id, name);
    else if (op.act === "merge") await r.mergeCollections(id, into);
    else await r.deleteCollection(id);
  }

  private holdConflict(report: FlushReport, c: Conflict) {
    this.conflicts = [...this.conflicts.filter((x) => x.id !== c.id), c];
    report.conflicts += 1;
  }

  /**
   * Applies the student's decision on a clash: keep mine, keep the account's version, or choose
   * field by field. The version that is not kept stays in the history list and can be brought back.
   */
  async resolveConflict(
    id: string,
    choice: Side | Partial<Record<keyof QuestionInput, Side>>,
  ): Promise<void> {
    await this.load();
    const c = this.conflicts.find((x) => x.id === id);
    if (!c) return;
    if (!this.isOnline()) throw new Error("Connect to the internet to apply your decision.");
    let outcome: ResolvedConflict["outcome"];
    if (c.kind === "deleted") {
      if (choice === "mine") {
        await this.remote.create([c.mine], [crypto.randomUUID()]);
        outcome = "re-added";
      } else {
        outcome = "discarded";
      }
    } else if (choice === "theirs") {
      outcome = "theirs";
    } else {
      await this.remote.update(id, applyChoices(c, choice));
      outcome = choice === "mine" ? "mine" : "merged";
    }
    this.conflicts = this.conflicts.filter((x) => x.id !== id);
    this.resolved = [
      { conflict: c, outcome, at: new Date().toISOString() },
      ...this.resolved,
    ].slice(0, KEEP_RESOLVED);
    await this.store.set(conflictsKey(this.userId), this.conflicts);
    await this.store.set(resolvedKey(this.userId), this.resolved);
    this.changed();
    if (this.enabled) await this.download().catch(() => undefined);
    this.flushedListeners.forEach((l) => l({ sent: 1, merged: 0, conflicts: 0, failed: 0 }));
  }

  /** Brings back one side of an earlier decision, as a new edit (or a new question if it was deleted). */
  async reapply(index: number, side: Side): Promise<void> {
    await this.load();
    const entry = this.resolved[index];
    if (!entry) return;
    if (!this.isOnline()) throw new Error("Connect to the internet to bring a version back.");
    const input = side === "mine" ? entry.conflict.mine : entry.conflict.theirs;
    if (!input) return;
    if ((await this.remote.getMany([entry.conflict.id])).length > 0) {
      await this.remote.update(entry.conflict.id, input);
    } else {
      await this.remote.create([input], [crypto.randomUUID()]);
    }
    if (this.enabled) await this.download().catch(() => undefined);
    this.flushedListeners.forEach((l) => l({ sent: 1, merged: 0, conflicts: 0, failed: 0 }));
  }

  /** Forgets the list of refused changes once the student has seen it. */
  async dismissFailed(): Promise<void> {
    await this.load();
    this.failed = [];
    await this.store.del(failedKey(this.userId));
    this.changed();
  }

  /** Subjects, tags and collections: sent now when online, otherwise kept on this device and sent in order. */
  private organise<T>(op: Omit<OrganizeOp, "kind" | "label">, direct: () => Promise<T>, result: T) {
    const list =
      op.what === "node"
        ? this.pack?.taxonomy
        : op.what === "tag"
          ? this.pack?.tags
          : this.pack?.collections;
    const label = (list?.find((x) => x.id === op.id) as { name?: string } | undefined)?.name ?? "";
    return this.edit([{ kind: "organize", label, ...op }], direct, result);
  }

  addNode: QuestionRepo["addNode"] = async (parentId, name) => {
    await this.load();
    const id = crypto.randomUUID();
    const depth = parentId
      ? KIND_BY_DEPTH.indexOf(
          this.pack?.taxonomy.find((n) => n.id === parentId)?.kind ?? "subject",
        ) + 1
      : 0;
    const node: TaxonomyNode = {
      id,
      parentId,
      kind: KIND_BY_DEPTH[Math.min(depth, 3)]!,
      name,
      position: 0,
      color: null,
    };
    return this.organise(
      { what: "node", act: "add", id, name, parentId },
      () => this.remote.addNode(parentId, name),
      node,
    );
  };
  renameNode = (id: string, name: string) =>
    this.organise(
      { what: "node", act: "rename", id, name },
      () => this.remote.renameNode(id, name),
      undefined,
    );
  setNodeColor = (id: string, color: string | null) =>
    this.organise(
      { what: "node", act: "color", id, color },
      () => this.remote.setNodeColor(id, color),
      undefined,
    );
  deleteNode = (id: string) =>
    this.organise({ what: "node", act: "delete", id }, () => this.remote.deleteNode(id), undefined);
  addTag = async (name: string) => {
    const id = crypto.randomUUID();
    return this.organise({ what: "tag", act: "add", id, name }, () => this.remote.addTag(name), {
      id,
      name,
      count: 0,
    });
  };
  renameTag = (id: string, name: string) =>
    this.organise(
      { what: "tag", act: "rename", id, name },
      () => this.remote.renameTag(id, name),
      undefined,
    );
  deleteTag = (id: string) =>
    this.organise({ what: "tag", act: "delete", id }, () => this.remote.deleteTag(id), undefined);
  mergeTags = (from: string, into: string) =>
    this.organise(
      { what: "tag", act: "merge", id: from, into },
      () => this.remote.mergeTags(from, into),
      undefined,
    );
  addCollection = async (name: string) => {
    const id = crypto.randomUUID();
    return this.organise(
      { what: "collection", act: "add", id, name },
      () => this.remote.addCollection(name),
      { id, name, count: 0 },
    );
  };
  renameCollection = (id: string, name: string) =>
    this.organise(
      { what: "collection", act: "rename", id, name },
      () => this.remote.renameCollection(id, name),
      undefined,
    );
  deleteCollection = (id: string) =>
    this.organise(
      { what: "collection", act: "delete", id },
      () => this.remote.deleteCollection(id),
      undefined,
    );
  mergeCollections = (from: string, into: string) =>
    this.organise(
      { what: "collection", act: "merge", id: from, into },
      () => this.remote.mergeCollections(from, into),
      undefined,
    );

  /** What is waiting to be sent, one line each. */
  async pendingSummaries(): Promise<string[]> {
    await this.load();
    return [
      ...this.queue.map(summarise),
      ...this.conflicts.map((c) => `Decision needed: ${c.mine.stem.slice(0, 70)}`),
    ];
  }

  /**
   * Waiting changes as a file the student can keep: added and edited questions in the usual
   * import format, plus a plain list of the other changes. Null when nothing is waiting.
   */
  async exportPending(): Promise<string | null> {
    await this.load();
    if (this.queue.length === 0 && this.conflicts.length === 0) return null;
    const questions = [
      ...this.queue.flatMap((op) =>
        op.kind === "create" || op.kind === "update" ? [questionToRecord(op.input)] : [],
      ),
      ...this.conflicts.map((c) => questionToRecord(c.mine)), // my side of each undecided clash
    ];
    const others = this.queue
      .filter((op) => op.kind === "bulk" || op.kind === "organize")
      .map(summarise);
    return JSON.stringify(
      { format: "learivo-questions", version: 1, questions, otherChanges: others },
      null,
      2,
    );
  }

  /**
   * Wipes the copy on sign-out so the next person on this device cannot read it. Changes made
   * offline are sent first; if some cannot be sent this refuses, unless told to discard them.
   */
  async clear(opts: { discardUnsent?: boolean } = {}): Promise<void> {
    await this.load();
    if (this.queue.length > 0 && this.isOnline()) await this.flushEdits().catch(() => undefined);
    if ((this.queue.length > 0 || this.conflicts.length > 0) && !opts.discardUnsent) {
      throw new UnsentChangesError(await this.pendingSummaries());
    }
    for (const k of [editsKey, failedKey, conflictsKey, resolvedKey, idMapKey]) {
      await this.store.del(k(this.userId));
    }
    this.queue = [];
    this.idMap = {};
    this.failed = [];
    this.conflicts = [];
    this.resolved = [];
    await this.store.del(packKey(this.userId));
    this.pack = null;
    this.loaded = false;
  }
}
