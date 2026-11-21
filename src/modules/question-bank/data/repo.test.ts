import { beforeEach, describe, expect, it } from "vitest";
import { contentHash } from "../domain/hash.ts";
import { blankQuestion, type QuestionInput } from "../domain/model.ts";
import { TF_ANSWER } from "../../../testing/fixtures.ts";
import { checkedQuestionRow, toTsQuery } from "./supabaseRepo.ts";
import { UnexpectedDataError } from "../../../core/rowCheck.ts";
import { MemoryRepo } from "./memoryRepo.ts";
import { DEFAULT_QUERY, pathOf, subtreeIds, type QuestionQuery } from "./repo.ts";

const q = (over: Partial<QuestionQuery> = {}): QuestionQuery => ({ ...DEFAULT_QUERY, ...over });
const tf = (stem: string, over: Partial<QuestionInput> = {}): QuestionInput => ({
  ...blankQuestion("true_false"),
  stem,
  answer: TF_ANSWER,
  ...over,
});

let repo: MemoryRepo;
beforeEach(() => {
  repo = new MemoryRepo();
});

describe("toTsQuery", () => {
  it("builds a prefix search and drops punctuation", () => {
    expect(toTsQuery("  war  vit-K! ")).toBe("war:* & vitK:*");
    expect(toTsQuery("   ")).toBe("");
    expect(toTsQuery("হৃদয়")).toBe("হৃদয়:*");
  });
});

describe("taxonomy helpers", () => {
  it("finds paths and subtrees", async () => {
    await repo.create([
      tf("a", { path: ["Anatomy", "Thorax", "Heart"] }),
      tf("b", { path: ["Anatomy", "Abdomen"] }),
    ]);
    const nodes = await repo.taxonomy();
    const heart = nodes.find((n) => n.name === "Heart")!;
    expect(pathOf(heart.id, nodes)).toEqual(["Anatomy", "Thorax", "Heart"]);
    const subject = nodes.find((n) => n.name === "Anatomy")!;
    expect(subtreeIds(subject.id, nodes).length).toBe(4);
    expect(nodes.map((n) => n.kind).sort()).toEqual(["chapter", "chapter", "subject", "topic"]);
  });
});

describe("MemoryRepo behaves like the database", () => {
  it("creates questions with paths and tags, reusing existing ones case-insensitively", async () => {
    await repo.create([
      tf("one", { path: ["Anatomy"], tags: ["High-Yield"] }),
      tf("two", { path: ["anatomy"], tags: ["high-yield"] }),
    ]);
    expect((await repo.taxonomy()).length).toBe(1);
    expect((await repo.tags()).map((t) => [t.name, t.count])).toEqual([["High-Yield", 2]]);
  });

  it("rejects an invalid question", async () => {
    await expect(
      repo.create([{ ...blankQuestion("sba"), stem: "No options filled" }]),
    ).rejects.toThrow();
  });

  it("bumps the version on edit and keeps history newest first", async () => {
    const [id] = await repo.create([tf("first")]);
    await repo.update(id!, tf("second"));
    await repo.update(id!, tf("third"));
    const rec = await repo.get(id!);
    expect(rec!.version).toBe(3);
    expect((await repo.versions(id!)).map((v) => [v.version, v.question.stem])).toEqual([
      [3, "third"],
      [2, "second"],
      [1, "first"],
    ]);
  });

  it("keeps only 20 versions", async () => {
    const [id] = await repo.create([tf("v")]);
    for (let i = 0; i < 25; i++) await repo.update(id!, tf(`v${i}`));
    const v = await repo.versions(id!);
    expect(v.length).toBe(20);
    expect(v[0]!.version).toBe(26);
  });

  it("searches by word prefix and filters by type, difficulty, tag and subject", async () => {
    await repo.create([
      tf("Warfarin is an anticoagulant", {
        difficulty: 2,
        path: ["Pharmacology"],
        tags: ["drugs"],
      }),
      {
        ...blankQuestion("fill_blank"),
        stem: "The largest artery is the {{1}}",
        answer: { blanks: [{ accepted: ["aorta"] }] },
        difficulty: 3,
      },
    ]);
    expect((await repo.list(q({ search: "warf" }))).total).toBe(1);
    expect((await repo.list(q({ search: "warf anti" }))).total).toBe(1);
    expect((await repo.list(q({ search: "warf zzz" }))).total).toBe(0);
    expect((await repo.list(q({ qtypes: ["fill_blank"] }))).items[0]!.stem).toContain("artery");
    expect((await repo.list(q({ difficulties: [2] }))).total).toBe(1);
    const [tag] = await repo.tags();
    expect((await repo.list(q({ tagId: tag!.id }))).total).toBe(1);
    const subject = (await repo.taxonomy())[0]!;
    expect((await repo.list(q({ nodeId: subject.id }))).total).toBe(1);
    expect((await repo.list(q({ unclassified: true }))).total).toBe(1);
  });

  it("pages and sorts", async () => {
    await repo.create(
      Array.from({ length: 7 }, (_, i) => tf(`Question ${String.fromCharCode(71 - i)}`)),
    );
    const p1 = await repo.list(q({ limit: 3, offset: 0, sort: "stem" }));
    const p3 = await repo.list(q({ limit: 3, offset: 6, sort: "stem" }));
    expect(p1.total).toBe(7);
    expect(p1.items.map((r) => r.stem)).toEqual(["Question A", "Question B", "Question C"]);
    expect(p3.items.map((r) => r.stem)).toEqual(["Question G"]);
    expect((await repo.list(q({ limit: 2 }))).items[0]!.stem).toBe("Question A"); // newest first
  });

  it("archives, restores and deletes", async () => {
    const ids = await repo.create([tf("a"), tf("b"), tf("c")]);
    await repo.bulk([ids[0]!, ids[1]!], { kind: "archive" });
    expect((await repo.list(q())).total).toBe(1);
    expect((await repo.list(q({ status: "archived" }))).total).toBe(2);
    await repo.bulk([ids[0]!], { kind: "restore" });
    await repo.bulk([ids[1]!], { kind: "delete" });
    expect((await repo.list(q({ status: "archived" }))).total).toBe(0);
    expect((await repo.list(q())).total).toBe(2);
  });

  it("tags, classifies and collects in bulk", async () => {
    const ids = await repo.create([tf("a"), tf("b")]);
    const tag = await repo.addTag("review");
    const col = await repo.addCollection("Finals");
    const subject = await repo.addNode(null, "Physiology");
    await repo.bulk(ids, { kind: "tag", tagId: tag.id, add: true });
    await repo.bulk(ids, { kind: "collection", collectionId: col.id, add: true });
    await repo.bulk(ids, { kind: "classify", nodeId: subject.id });
    expect((await repo.tags())[0]!.count).toBe(2);
    expect((await repo.collections())[0]!.count).toBe(2);
    expect(
      (await repo.list(q({ collectionId: col.id }))).items.every((r) => r.path[0] === "Physiology"),
    ).toBe(true);
    await repo.bulk([ids[0]!], { kind: "tag", tagId: tag.id, add: false });
    expect((await repo.tags())[0]!.count).toBe(1);
  });

  it("deleting a subject keeps its questions and clears their classification", async () => {
    const [id] = await repo.create([tf("a", { path: ["Anatomy", "Thorax"] })]);
    const subject = (await repo.taxonomy()).find((n) => n.kind === "subject")!;
    await repo.deleteNode(subject.id);
    expect((await repo.get(id!))!.path).toEqual([]);
    expect((await repo.taxonomy()).length).toBe(0);
  });

  it("gives a subject a colour, and clears it again", async () => {
    await repo.create([tf("a", { path: ["Anatomy"] })]);
    const subject = (await repo.taxonomy()).find((n) => n.kind === "subject")!;
    expect(subject.color ?? null).toBeNull();
    await repo.setNodeColor(subject.id, "teal");
    expect((await repo.taxonomy())[0]!.color).toBe("teal");
    await repo.setNodeColor(subject.id, null);
    expect((await repo.taxonomy())[0]!.color).toBeNull();
  });

  it("deleting a tag or collection keeps the questions", async () => {
    const [id] = await repo.create([tf("a", { tags: ["x"] })]);
    const [tag] = await repo.tags();
    await repo.deleteTag(tag!.id);
    expect((await repo.get(id!))!.tags).toEqual([]);
  });

  it("refuses duplicate names and a fifth taxonomy level", async () => {
    await repo.addNode(null, "Anatomy");
    await expect(repo.addNode(null, "anatomy")).rejects.toThrow("already used");
    const s = (await repo.taxonomy())[0]!;
    const c = await repo.addNode(s.id, "C");
    const t = await repo.addNode(c.id, "T");
    const st = await repo.addNode(t.id, "S");
    await expect(repo.addNode(st.id, "X")).rejects.toThrow();
    await repo.addTag("a");
    await expect(repo.addTag("A")).rejects.toThrow("already exists");
  });

  it("reports hashes for duplicate detection and exports active questions only", async () => {
    const ids = await repo.create([tf("Same  Text"), tf("Other")]);
    expect((await repo.hashes()).has(contentHash("same text", "true_false"))).toBe(true);
    await repo.bulk([ids[1]!], { kind: "archive" });
    expect((await repo.exportAll()).map((e) => e.stem)).toEqual(["Same  Text"]);
  });
});

describe("merging", () => {
  it("moves the questions of one tag to another and removes the first", async () => {
    await repo.create([
      tf("a", { tags: ["old"] }),
      tf("b", { tags: ["old", "new"] }),
      tf("c", { tags: ["new"] }),
    ]);
    const tags = await repo.tags();
    const old = tags.find((t) => t.name === "old")!;
    const keep = tags.find((t) => t.name === "new")!;
    await repo.mergeTags(old.id, keep.id);
    const after = await repo.tags();
    expect(after.map((t) => t.name)).toEqual(["new"]);
    expect(after[0]!.count).toBe(3);
  });

  it("moves the questions of one collection into another", async () => {
    const ids = await repo.create([tf("a"), tf("b")]);
    const from = await repo.addCollection("From");
    const into = await repo.addCollection("Into");
    await repo.bulk(ids, { kind: "collection", collectionId: from.id, add: true });
    await repo.bulk([ids[0]!], { kind: "collection", collectionId: into.id, add: true });
    await repo.mergeCollections(from.id, into.id);
    const after = await repo.collections();
    expect(after.map((c) => c.name)).toEqual(["Into"]);
    expect(after[0]!.count).toBe(2);
  });
});

describe("checkedQuestionRow", () => {
  const row = {
    id: "q1",
    qtype: "sba",
    stem: "Which nerve supplies the deltoid?",
    explanation: "",
    answer_spec: { options: [{ text: "Axillary", correct: true }] },
    difficulty: null,
    taxonomy_node_id: null,
    source: "",
    institution: "",
    exam_name: "",
    exam_year: null,
    status: "active",
    version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    question_tags: [{ tag_id: "t1" }],
  };

  it("accepts a row shaped like the database's, with links missing or present", () => {
    expect(checkedQuestionRow(row as never)).toBe(row);
    const bare: Record<string, unknown> = { ...row };
    delete bare.question_tags;
    expect(checkedQuestionRow(bare as never)).toBe(bare);
  });

  it("accepts a fill-in-the-blank answer that has blanks instead of options", () => {
    const blank = { ...row, qtype: "fill_blank", answer_spec: { blanks: [{ accepted: ["x"] }] } };
    expect(checkedQuestionRow(blank as never)).toBe(blank);
  });

  it("stops on a row the app could not show: no stem, unknown type, or no options", () => {
    expect(() => checkedQuestionRow({ ...row, stem: null } as never)).toThrow(UnexpectedDataError);
    expect(() => checkedQuestionRow({ ...row, qtype: "essay" } as never)).toThrow(
      UnexpectedDataError,
    );
    expect(() => checkedQuestionRow({ ...row, answer_spec: {} } as never)).toThrow(
      /does not understand/,
    );
  });
});
