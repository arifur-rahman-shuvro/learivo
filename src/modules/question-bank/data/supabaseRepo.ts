import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnswerSpec, QuestionInput, QuestionType } from "../domain/model.ts";
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

const COLUMNS =
  "id, qtype, stem, explanation, answer_spec, difficulty, taxonomy_node_id, source, institution, exam_name, exam_year, status, version, created_at, updated_at";
const WITH_LINKS = `${COLUMNS}, question_tags(tag_id), collection_questions(collection_id)`;

interface QuestionRow {
  id: string;
  qtype: QuestionType;
  stem: string;
  explanation: string;
  answer_spec: AnswerSpec;
  difficulty: number | null;
  taxonomy_node_id: string | null;
  source: string;
  institution: string;
  exam_name: string;
  exam_year: number | null;
  status: "active" | "archived";
  version: number;
  created_at: string;
  updated_at: string;
  question_tags?: { tag_id: string }[];
  collection_questions?: { collection_id: string }[];
}

interface Failure {
  code?: string;
  message: string;
}

/** Turn a database error into a message a student can act on. */
function fail(e: Failure): never {
  if (e.code === "23505") throw new Error("That name is already used.");
  if (e.code === "42501" || e.code === "PGRST301")
    throw new Error("Your session has ended. Sign in again.");
  throw new Error("Could not reach your question bank. Check your connection and try again.");
}

function ok<T>(r: { data: T | null; error: Failure | null }): T {
  if (r.error) fail(r.error);
  return r.data as T;
}

const chunk = <T>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/** A prefix search the database understands: "war vit" becomes "war:* & vit:*". */
export function toTsQuery(search: string): string {
  return (
    search
      .split(/\s+/)
      // Keep letters, digits and combining marks: Bengali vowel signs are marks, not letters.
      .map((w) => w.replace(/[^\p{L}\p{M}\p{N}]/gu, ""))
      .filter(Boolean)
      .map((w) => `${w}:*`)
      .join(" & ")
  );
}

export class SupabaseRepo implements QuestionRepo {
  private nodeCache: TaxonomyNode[] | null = null;
  private tagCache: { id: string; name: string }[] | null = null;

  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  // ---------------------------------------------------------------- helpers
  private async nodes(): Promise<TaxonomyNode[]> {
    if (!this.nodeCache) await this.taxonomy();
    return this.nodeCache!;
  }

  private async tagNames(): Promise<{ id: string; name: string }[]> {
    if (!this.tagCache) {
      this.tagCache = ok(await this.db.from("tags").select("id, name").order("name")) ?? [];
    }
    return this.tagCache;
  }

  private async toRecord(row: QuestionRow): Promise<QuestionRecord> {
    const [nodes, tags] = await Promise.all([this.nodes(), this.tagNames()]);
    const tagIds = (row.question_tags ?? []).map((t) => t.tag_id);
    return {
      id: row.id,
      qtype: row.qtype,
      stem: row.stem,
      explanation: row.explanation,
      answer: row.answer_spec,
      difficulty: row.difficulty,
      source: row.source,
      institution: row.institution,
      examName: row.exam_name,
      examYear: row.exam_year,
      path: pathOf(row.taxonomy_node_id, nodes),
      tags: tagIds.map((id) => tags.find((t) => t.id === id)?.name ?? "").filter(Boolean),
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      nodeId: row.taxonomy_node_id,
      tagIds,
      collectionIds: (row.collection_questions ?? []).map((c) => c.collection_id),
    };
  }

  private columns(input: QuestionInput, nodeId: string | null) {
    return {
      qtype: input.qtype,
      stem: input.stem,
      explanation: input.explanation,
      answer_spec: input.answer,
      difficulty: input.difficulty,
      taxonomy_node_id: nodeId,
      source: input.source,
      institution: input.institution,
      exam_name: input.examName,
      exam_year: input.examYear,
    };
  }

  /** Find or create the chain subject > chapter > ... for a list of names. */
  private async ensurePath(path: string[]): Promise<string | null> {
    if (path.length === 0) return null;
    const nodes = await this.nodes();
    let parent: string | null = null;
    for (let depth = 0; depth < Math.min(path.length, 4); depth++) {
      const name = path[depth]!;
      let node = nodes.find(
        (n) => n.parentId === parent && n.name.toLowerCase() === name.toLowerCase(),
      );
      if (!node) node = await this.addNode(parent, name);
      parent = node.id;
    }
    return parent;
  }

  private async ensureTags(names: string[]): Promise<string[]> {
    const wanted = [...new Map(names.map((n) => [n.toLowerCase(), n])).values()];
    if (wanted.length === 0) return [];
    let known = await this.tagNames();
    const missing = wanted.filter(
      (n) => !known.some((t) => t.name.toLowerCase() === n.toLowerCase()),
    );
    if (missing.length > 0) {
      // The unique rule is on lower(name), which an upsert cannot target, so insert and
      // tolerate a duplicate created by another device a moment earlier.
      const res = await this.db
        .from("tags")
        .insert(missing.map((name) => ({ user_id: this.userId, name })));
      if (res.error && res.error.code !== "23505") fail(res.error);
      this.tagCache = null;
      known = await this.tagNames();
    }
    return wanted.map((n) => known.find((t) => t.name.toLowerCase() === n.toLowerCase())!.id);
  }

  // -------------------------------------------------------------- questions
  async list(q: QuestionQuery): Promise<Page<QuestionRecord>> {
    const nodes = await this.nodes();
    const select = [WITH_LINKS];
    if (q.tagId) select.push("tag_filter:question_tags!inner(tag_id)");
    if (q.collectionId) select.push("collection_filter:collection_questions!inner(collection_id)");

    let query = this.db
      .from("questions")
      .select(select.join(", "), { count: "exact" })
      .eq("status", q.status);
    if (q.tagId) query = query.eq("tag_filter.tag_id", q.tagId);
    if (q.collectionId) query = query.eq("collection_filter.collection_id", q.collectionId);
    if (q.nodeId) query = query.in("taxonomy_node_id", subtreeIds(q.nodeId, nodes));
    if (q.unclassified) query = query.is("taxonomy_node_id", null);
    if (q.qtypes.length) query = query.in("qtype", q.qtypes);
    if (q.difficulties.length) query = query.in("difficulty", q.difficulties);
    const ts = toTsQuery(q.search);
    if (ts) query = query.textSearch("search", ts, { config: "simple" });

    query =
      q.sort === "stem"
        ? query.order("stem")
        : q.sort === "created"
          ? query.order("created_at", { ascending: false })
          : query.order("updated_at", { ascending: false });
    const res = await query.order("id").range(q.offset, q.offset + q.limit - 1);
    if (res.error) fail(res.error);
    const rows = (res.data ?? []) as unknown as QuestionRow[];
    return {
      total: res.count ?? rows.length,
      items: await Promise.all(rows.map((r) => this.toRecord(r))),
    };
  }

  async get(id: string) {
    const row = ok(
      await this.db.from("questions").select(WITH_LINKS).eq("id", id).maybeSingle(),
    ) as QuestionRow | null;
    return row ? this.toRecord(row) : null;
  }

  async create(inputs: QuestionInput[]): Promise<string[]> {
    const nodeIds = new Map<string, string | null>();
    for (const input of inputs) {
      const key = input.path.join("\u0000").toLowerCase();
      if (!nodeIds.has(key)) nodeIds.set(key, await this.ensurePath(input.path));
    }
    const tagIdsByInput: string[][] = [];
    const allNames = [...new Set(inputs.flatMap((i) => i.tags))];
    await this.ensureTags(allNames);
    for (const input of inputs) tagIdsByInput.push(await this.ensureTags(input.tags));

    const ids: string[] = [];
    for (const part of chunk(
      inputs.map((input, i) => ({ input, i })),
      500,
    )) {
      const rows = part.map(({ input }) => ({
        user_id: this.userId,
        ...this.columns(input, nodeIds.get(input.path.join("\u0000").toLowerCase()) ?? null),
      }));
      const created = ok(await this.db.from("questions").insert(rows).select("id")) as {
        id: string;
      }[];
      ids.push(...created.map((r) => r.id));
    }

    const links = ids.flatMap((id, i) =>
      (tagIdsByInput[i] ?? []).map((tag_id) => ({ question_id: id, tag_id, user_id: this.userId })),
    );
    for (const part of chunk(links, 1000)) ok(await this.db.from("question_tags").insert(part));
    return ids;
  }

  async update(id: string, input: QuestionInput) {
    const nodeId = await this.ensurePath(input.path);
    ok(await this.db.from("questions").update(this.columns(input, nodeId)).eq("id", id));
    const tagIds = await this.ensureTags(input.tags);
    ok(await this.db.from("question_tags").delete().eq("question_id", id));
    if (tagIds.length) {
      ok(
        await this.db
          .from("question_tags")
          .insert(tagIds.map((tag_id) => ({ question_id: id, tag_id, user_id: this.userId }))),
      );
    }
  }

  async bulk(ids: string[], a: BulkAction) {
    for (const part of chunk(ids, 100)) {
      if (a.kind === "archive" || a.kind === "restore") {
        ok(
          await this.db
            .from("questions")
            .update({ status: a.kind === "archive" ? "archived" : "active" })
            .in("id", part),
        );
      } else if (a.kind === "delete") {
        ok(await this.db.from("questions").delete().in("id", part));
      } else if (a.kind === "classify") {
        ok(await this.db.from("questions").update({ taxonomy_node_id: a.nodeId }).in("id", part));
      } else if (a.kind === "tag") {
        if (a.add) {
          ok(
            await this.db.from("question_tags").upsert(
              part.map((question_id) => ({ question_id, tag_id: a.tagId, user_id: this.userId })),
              { onConflict: "question_id,tag_id", ignoreDuplicates: true },
            ),
          );
        } else {
          ok(
            await this.db
              .from("question_tags")
              .delete()
              .in("question_id", part)
              .eq("tag_id", a.tagId),
          );
        }
      } else if (a.add) {
        ok(
          await this.db.from("collection_questions").upsert(
            part.map((question_id) => ({
              question_id,
              collection_id: a.collectionId,
              user_id: this.userId,
            })),
            { onConflict: "collection_id,question_id", ignoreDuplicates: true },
          ),
        );
      } else {
        ok(
          await this.db
            .from("collection_questions")
            .delete()
            .in("question_id", part)
            .eq("collection_id", a.collectionId),
        );
      }
    }
  }

  async versions(id: string): Promise<QuestionVersion[]> {
    const nodes = await this.nodes();
    const rows = (ok(
      await this.db
        .from("question_versions")
        .select("version, created_at, snapshot")
        .eq("question_id", id)
        .order("version", { ascending: false }),
    ) ?? []) as { version: number; created_at: string; snapshot: Record<string, unknown> }[];
    return rows.map((r) => {
      const s = r.snapshot as unknown as QuestionRow;
      return {
        version: r.version,
        savedAt: r.created_at,
        question: {
          qtype: s.qtype,
          stem: s.stem,
          explanation: s.explanation,
          answer: s.answer_spec,
          difficulty: s.difficulty,
          source: s.source,
          institution: s.institution,
          examName: s.exam_name,
          examYear: s.exam_year,
          path: pathOf(s.taxonomy_node_id, nodes),
          tags: [],
        },
      };
    });
  }

  async hashes() {
    const out = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const rows = (ok(
        await this.db
          .from("questions")
          .select("content_hash")
          .order("id")
          .range(from, from + 999),
      ) ?? []) as { content_hash: string }[];
      rows.forEach((r) => out.add(r.content_hash));
      if (rows.length < 1000) return out;
    }
  }

  async exportAll(): Promise<QuestionInput[]> {
    const out: QuestionInput[] = [];
    for (let from = 0; ; from += 500) {
      const rows = (ok(
        await this.db
          .from("questions")
          .select(WITH_LINKS)
          .eq("status", "active")
          .order("created_at")
          .order("id")
          .range(from, from + 499),
      ) ?? []) as unknown as QuestionRow[];
      for (const row of rows) {
        const r = await this.toRecord(row);
        out.push({
          qtype: r.qtype,
          stem: r.stem,
          explanation: r.explanation,
          answer: r.answer,
          difficulty: r.difficulty,
          source: r.source,
          institution: r.institution,
          examName: r.examName,
          examYear: r.examYear,
          path: r.path,
          tags: r.tags,
        });
      }
      if (rows.length < 500) return out;
    }
  }

  // --------------------------------------------------------------- taxonomy
  async taxonomy(): Promise<TaxonomyNode[]> {
    const rows = (ok(
      await this.db
        .from("taxonomy_nodes")
        .select("id, parent_id, kind, name, position")
        .order("position")
        .order("name"),
    ) ?? []) as {
      id: string;
      parent_id: string | null;
      kind: TaxonomyNode["kind"];
      name: string;
      position: number;
    }[];
    this.nodeCache = rows.map((r) => ({
      id: r.id,
      parentId: r.parent_id,
      kind: r.kind,
      name: r.name,
      position: r.position,
    }));
    return this.nodeCache;
  }

  async addNode(parentId: string | null, name: string): Promise<TaxonomyNode> {
    const nodes = await this.nodes();
    const parent = parentId ? nodes.find((n) => n.id === parentId) : null;
    const depth = parent ? KIND_BY_DEPTH.indexOf(parent.kind) + 1 : 0;
    if (depth > 3) throw new Error("A subtopic cannot have children.");
    const row = ok(
      await this.db
        .from("taxonomy_nodes")
        .insert({ user_id: this.userId, parent_id: parentId, kind: KIND_BY_DEPTH[depth], name })
        .select("id, parent_id, kind, name, position")
        .single(),
    ) as {
      id: string;
      parent_id: string | null;
      kind: TaxonomyNode["kind"];
      name: string;
      position: number;
    };
    const node: TaxonomyNode = {
      id: row.id,
      parentId: row.parent_id,
      kind: row.kind,
      name: row.name,
      position: row.position,
    };
    this.nodeCache = [...nodes, node];
    return node;
  }

  async renameNode(id: string, name: string) {
    ok(await this.db.from("taxonomy_nodes").update({ name }).eq("id", id));
    this.nodeCache = null;
  }

  async deleteNode(id: string) {
    ok(await this.db.from("taxonomy_nodes").delete().eq("id", id));
    this.nodeCache = null;
  }

  // ------------------------------------------------------------------- tags
  async tags(): Promise<Tag[]> {
    const rows = (ok(
      await this.db.from("tags").select("id, name, question_tags(count)").order("name"),
    ) ?? []) as { id: string; name: string; question_tags: { count: number }[] }[];
    this.tagCache = rows.map((r) => ({ id: r.id, name: r.name }));
    return rows.map((r) => ({ id: r.id, name: r.name, count: r.question_tags[0]?.count ?? 0 }));
  }
  async addTag(name: string): Promise<Tag> {
    const row = ok(
      await this.db.from("tags").insert({ user_id: this.userId, name }).select("id, name").single(),
    ) as { id: string; name: string };
    this.tagCache = null;
    return { ...row, count: 0 };
  }
  async renameTag(id: string, name: string) {
    ok(await this.db.from("tags").update({ name }).eq("id", id));
    this.tagCache = null;
  }
  async deleteTag(id: string) {
    ok(await this.db.from("tags").delete().eq("id", id));
    this.tagCache = null;
  }

  // ------------------------------------------------------------ collections
  async collections(): Promise<Collection[]> {
    const rows = (ok(
      await this.db
        .from("collections")
        .select("id, name, collection_questions(count)")
        .order("position")
        .order("name"),
    ) ?? []) as { id: string; name: string; collection_questions: { count: number }[] }[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      count: r.collection_questions[0]?.count ?? 0,
    }));
  }
  async addCollection(name: string): Promise<Collection> {
    const row = ok(
      await this.db
        .from("collections")
        .insert({ user_id: this.userId, name })
        .select("id, name")
        .single(),
    ) as { id: string; name: string };
    return { ...row, count: 0 };
  }
  async renameCollection(id: string, name: string) {
    ok(await this.db.from("collections").update({ name }).eq("id", id));
  }
  async deleteCollection(id: string) {
    ok(await this.db.from("collections").delete().eq("id", id));
  }
}
