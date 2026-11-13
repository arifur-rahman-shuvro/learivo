import { contentHash } from "../modules/question-bank/domain/hash.ts";
import type { QuestionInput } from "../modules/question-bank/domain/model.ts";
import {
  DEFAULT_QUERY,
  subtreeIds,
  type Collection,
  type Page,
  type QuestionQuery,
  type QuestionRecord,
  type QuestionRepo,
  type QuestionVersion,
  type Tag,
  type TaxonomyNode,
} from "../modules/question-bank/data/repo.ts";
import type { KeyValueStore } from "./store.ts";

/** A copy of the active question bank kept on this device so practice works without internet. */
export interface Pack {
  savedAt: string;
  questions: QuestionRecord[];
  taxonomy: TaxonomyNode[];
  tags: Tag[];
  collections: Collection[];
}

export const OFFLINE_MESSAGE = "You are offline. Changes to the question bank need a connection.";

/** Reads every active question and the lists that go with them. */
export async function buildPack(repo: QuestionRepo, now = () => new Date()): Promise<Pack> {
  const questions: QuestionRecord[] = [];
  for (let offset = 0; offset < 20000; offset += 500) {
    const page = await repo.list({ ...DEFAULT_QUERY, status: "active", offset, limit: 500 });
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
  deleteNode = async () => this.refuse();
  addTag = async () => this.refuse();
  renameTag = async () => this.refuse();
  deleteTag = async () => this.refuse();
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
}

/**
 * The question bank as the app sees it: the live one when there is a connection, the pack when
 * there is not. Reading keeps the pack fresh; changes always go to the live bank.
 */
export class OfflineAwareRepo implements QuestionRepo {
  private pack: Pack | null = null;
  private loaded = false;
  private enabled = true;
  private listeners = new Set<() => void>();

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
    this.loaded = true;
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
    };
  }

  /** Downloads the whole bank to this device. */
  async download(): Promise<PackStatus> {
    await this.load();
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
    if (this.enabled && this.isOnline()) await this.download();
  }

  /** Online: the live bank. Offline, or the live bank cannot be reached: the pack. */
  private async readOffline<T>(live: () => Promise<T>, local: (p: PackRepo) => Promise<T>) {
    await this.load();
    if (!this.isOnline() && this.pack) return local(new PackRepo(this.pack));
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

  private async write<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.isOnline()) throw new Error(OFFLINE_MESSAGE);
    return fn();
  }
  create = (i: QuestionInput[]) => this.write(() => this.remote.create(i));
  update = (id: string, i: QuestionInput) => this.write(() => this.remote.update(id, i));
  bulk: QuestionRepo["bulk"] = (ids, a) => this.write(() => this.remote.bulk(ids, a));
  addNode: QuestionRepo["addNode"] = (p, n) => this.write(() => this.remote.addNode(p, n));
  renameNode = (id: string, n: string) => this.write(() => this.remote.renameNode(id, n));
  deleteNode = (id: string) => this.write(() => this.remote.deleteNode(id));
  addTag = (n: string) => this.write(() => this.remote.addTag(n));
  renameTag = (id: string, n: string) => this.write(() => this.remote.renameTag(id, n));
  deleteTag = (id: string) => this.write(() => this.remote.deleteTag(id));
  addCollection = (n: string) => this.write(() => this.remote.addCollection(n));
  renameCollection = (id: string, n: string) =>
    this.write(() => this.remote.renameCollection(id, n));
  deleteCollection = (id: string) => this.write(() => this.remote.deleteCollection(id));

  /** Wipes the copy on sign-out so the next person on this device cannot read it. */
  async clear(): Promise<void> {
    await this.store.del(packKey(this.userId));
    this.pack = null;
    this.loaded = false;
  }
}
