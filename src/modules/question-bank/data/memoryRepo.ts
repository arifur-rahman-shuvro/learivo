import { contentHash } from "../domain/hash.ts";
import { validateQuestion, type QuestionInput } from "../domain/model.ts";
import {
  KIND_BY_DEPTH,
  pathOf,
  subtreeIds,
  type BulkAction,
  type Collection,
  type Page,
  type QuestionQuery,
  type QuestionRecord,
  type QuestionRepo,
  type QuestionVersion,
  type Tag,
  type TaxonomyNode,
} from "./repo.ts";

interface Row {
  id: string;
  input: QuestionInput;
  nodeId: string | null;
  status: "active" | "archived";
  version: number;
  createdAt: string;
  updatedAt: string;
  tagIds: Set<string>;
  collectionIds: Set<string>;
  history: QuestionVersion[];
}

/** In-memory repository that follows the same rules as the database. For tests and demos. */
export class MemoryRepo implements QuestionRepo {
  private rows = new Map<string, Row>();
  private nodes: TaxonomyNode[] = [];
  private tagList: { id: string; name: string }[] = [];
  private collectionList: { id: string; name: string }[] = [];
  private seq = 0;
  private clock = 1_700_000_000_000;

  private id(prefix: string) {
    return `${prefix}-${++this.seq}`;
  }
  private now() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  // ---- helpers shared by create and update
  private ensurePath(path: string[]): string | null {
    let parent: string | null = null;
    path.slice(0, 4).forEach((name, depth) => {
      const found = this.nodes.find(
        (n) => n.parentId === parent && n.name.toLowerCase() === name.toLowerCase(),
      );
      if (found) parent = found.id;
      else {
        const node: TaxonomyNode = {
          id: this.id("node"),
          parentId: parent,
          kind: KIND_BY_DEPTH[depth]!,
          name,
          position: this.nodes.filter((n) => n.parentId === parent).length,
        };
        this.nodes.push(node);
        parent = node.id;
      }
    });
    return parent;
  }

  private ensureTagIds(names: string[]): Set<string> {
    const ids = new Set<string>();
    for (const name of names) {
      let t = this.tagList.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (!t) {
        t = { id: this.id("tag"), name };
        this.tagList.push(t);
      }
      ids.add(t.id);
    }
    return ids;
  }

  private snapshot(row: Row) {
    row.history.push({
      version: row.version,
      savedAt: row.updatedAt,
      question: structuredClone(row.input),
    });
    while (row.history.length > 20) row.history.shift();
  }

  private record(row: Row): QuestionRecord {
    return {
      ...structuredClone(row.input),
      path: pathOf(row.nodeId, this.nodes),
      tags: [...row.tagIds].map((id) => this.tagList.find((t) => t.id === id)!.name),
      id: row.id,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      nodeId: row.nodeId,
      tagIds: [...row.tagIds],
      collectionIds: [...row.collectionIds],
    };
  }

  private checked(input: QuestionInput): QuestionInput {
    const r = validateQuestion(input);
    if (!r.ok) throw new Error(r.issues[0]!.message);
    return r.value;
  }

  // ---- questions
  async list(q: QuestionQuery): Promise<Page<QuestionRecord>> {
    const words = q.search.toLowerCase().split(/\s+/).filter(Boolean);
    const within = q.nodeId ? new Set(subtreeIds(q.nodeId, this.nodes)) : null;
    let items = [...this.rows.values()].filter((r) => {
      if (r.status !== q.status) return false;
      if (within && !(r.nodeId && within.has(r.nodeId))) return false;
      if (q.unclassified && r.nodeId) return false;
      if (q.qtypes.length && !q.qtypes.includes(r.input.qtype)) return false;
      if (
        q.difficulties.length &&
        !(r.input.difficulty && q.difficulties.includes(r.input.difficulty))
      )
        return false;
      if (q.tagId && !r.tagIds.has(q.tagId)) return false;
      if (q.collectionId && !r.collectionIds.has(q.collectionId)) return false;
      const hay = `${r.input.stem} ${r.input.explanation}`.toLowerCase();
      return words.every((w) => hay.split(/[^\p{L}\p{N}]+/u).some((t) => t.startsWith(w)));
    });
    items = items.sort((a, b) =>
      q.sort === "stem"
        ? a.input.stem.localeCompare(b.input.stem)
        : q.sort === "created"
          ? b.createdAt.localeCompare(a.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
    return {
      total: items.length,
      items: items.slice(q.offset, q.offset + q.limit).map((r) => this.record(r)),
    };
  }

  async get(id: string) {
    const r = this.rows.get(id);
    return r ? this.record(r) : null;
  }

  async getMany(ids: string[]) {
    return ids.flatMap((id) => {
      const r = this.rows.get(id);
      return r ? [this.record(r)] : [];
    });
  }

  async create(inputs: QuestionInput[]) {
    const ids: string[] = [];
    for (const raw of inputs) {
      const input = this.checked(raw);
      const at = this.now();
      const row: Row = {
        id: this.id("q"),
        input,
        nodeId: this.ensurePath(input.path),
        status: "active",
        version: 1,
        createdAt: at,
        updatedAt: at,
        tagIds: this.ensureTagIds(input.tags),
        collectionIds: new Set(),
        history: [],
      };
      this.snapshot(row);
      this.rows.set(row.id, row);
      ids.push(row.id);
    }
    return ids;
  }

  async update(id: string, raw: QuestionInput) {
    const row = this.rows.get(id);
    if (!row) throw new Error("Question not found.");
    row.input = this.checked(raw);
    row.nodeId = this.ensurePath(row.input.path);
    row.tagIds = this.ensureTagIds(row.input.tags);
    row.version += 1;
    row.updatedAt = this.now();
    this.snapshot(row);
  }

  async bulk(ids: string[], a: BulkAction) {
    for (const id of ids) {
      const row = this.rows.get(id);
      if (!row) continue;
      if (a.kind === "archive") row.status = "archived";
      else if (a.kind === "restore") row.status = "active";
      else if (a.kind === "delete") this.rows.delete(id);
      else if (a.kind === "classify") row.nodeId = a.nodeId;
      else if (a.kind === "tag") {
        if (a.add) row.tagIds.add(a.tagId);
        else row.tagIds.delete(a.tagId);
      } else if (a.add) row.collectionIds.add(a.collectionId);
      else row.collectionIds.delete(a.collectionId);
    }
  }

  async versions(id: string) {
    return structuredClone([...(this.rows.get(id)?.history ?? [])].reverse());
  }

  async hashes() {
    return new Set([...this.rows.values()].map((r) => contentHash(r.input.stem, r.input.qtype)));
  }

  async exportAll() {
    return [...this.rows.values()]
      .filter((r) => r.status === "active")
      .map((r) => {
        const rec = this.record(r);
        return {
          qtype: rec.qtype,
          stem: rec.stem,
          explanation: rec.explanation,
          answer: rec.answer,
          difficulty: rec.difficulty,
          source: rec.source,
          institution: rec.institution,
          examName: rec.examName,
          examYear: rec.examYear,
          path: rec.path,
          tags: rec.tags,
        };
      });
  }

  // ---- taxonomy
  async taxonomy() {
    return structuredClone(this.nodes);
  }
  async addNode(parentId: string | null, name: string) {
    const parent = parentId ? this.nodes.find((n) => n.id === parentId) : null;
    const depth = parent ? KIND_BY_DEPTH.indexOf(parent.kind) + 1 : 0;
    if (depth > 3) throw new Error("A subtopic cannot have children.");
    if (
      this.nodes.some((n) => n.parentId === parentId && n.name.toLowerCase() === name.toLowerCase())
    ) {
      throw new Error("That name is already used here.");
    }
    const node: TaxonomyNode = {
      id: this.id("node"),
      parentId,
      kind: KIND_BY_DEPTH[depth]!,
      name,
      position: 0,
    };
    this.nodes.push(node);
    return structuredClone(node);
  }
  async renameNode(id: string, name: string) {
    const n = this.nodes.find((x) => x.id === id);
    if (n) n.name = name;
  }
  async deleteNode(id: string) {
    const gone = new Set(subtreeIds(id, this.nodes));
    this.nodes = this.nodes.filter((n) => !gone.has(n.id));
    for (const r of this.rows.values()) if (r.nodeId && gone.has(r.nodeId)) r.nodeId = null;
  }

  // ---- tags and collections
  async tags(): Promise<Tag[]> {
    return this.tagList.map((t) => ({
      ...t,
      count: [...this.rows.values()].filter((r) => r.tagIds.has(t.id)).length,
    }));
  }
  async addTag(name: string) {
    if (this.tagList.some((t) => t.name.toLowerCase() === name.toLowerCase()))
      throw new Error("That tag already exists.");
    const t = { id: this.id("tag"), name };
    this.tagList.push(t);
    return { ...t, count: 0 };
  }
  async renameTag(id: string, name: string) {
    const t = this.tagList.find((x) => x.id === id);
    if (t) t.name = name;
  }
  async deleteTag(id: string) {
    this.tagList = this.tagList.filter((t) => t.id !== id);
    for (const r of this.rows.values()) r.tagIds.delete(id);
  }
  async collections(): Promise<Collection[]> {
    return this.collectionList.map((c) => ({
      ...c,
      count: [...this.rows.values()].filter((r) => r.collectionIds.has(c.id)).length,
    }));
  }
  async addCollection(name: string) {
    if (this.collectionList.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      throw new Error("That collection already exists.");
    const c = { id: this.id("col"), name };
    this.collectionList.push(c);
    return { ...c, count: 0 };
  }
  async renameCollection(id: string, name: string) {
    const c = this.collectionList.find((x) => x.id === id);
    if (c) c.name = name;
  }
  async deleteCollection(id: string) {
    this.collectionList = this.collectionList.filter((c) => c.id !== id);
    for (const r of this.rows.values()) r.collectionIds.delete(id);
  }
}
