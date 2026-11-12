import type { QuestionInput, QuestionType, TaxonomyKind } from "../domain/model.ts";

export interface TaxonomyNode {
  id: string;
  parentId: string | null;
  kind: TaxonomyKind;
  name: string;
  position: number;
}

export interface Tag {
  id: string;
  name: string;
  count: number;
}

export interface Collection {
  id: string;
  name: string;
  count: number;
}

/** A saved question: what the editor edits, plus the fields the database controls. */
export interface QuestionRecord extends QuestionInput {
  id: string;
  status: "active" | "archived";
  version: number;
  createdAt: string;
  updatedAt: string;
  nodeId: string | null;
  tagIds: string[];
  collectionIds: string[];
}

export interface QuestionQuery {
  search: string;
  status: "active" | "archived";
  /** Includes everything below this subject, chapter or topic. */
  nodeId: string | null;
  /** Only questions with no subject. */
  unclassified: boolean;
  qtypes: QuestionType[];
  difficulties: number[];
  tagId: string | null;
  collectionId: string | null;
  sort: "updated" | "created" | "stem";
  offset: number;
  limit: number;
}

export const DEFAULT_QUERY: QuestionQuery = {
  search: "",
  status: "active",
  nodeId: null,
  unclassified: false,
  qtypes: [],
  difficulties: [],
  tagId: null,
  collectionId: null,
  sort: "updated",
  offset: 0,
  limit: 50,
};

export interface Page<T> {
  items: T[];
  total: number;
}

export interface QuestionVersion {
  version: number;
  savedAt: string;
  question: QuestionInput;
}

export type BulkAction =
  | { kind: "archive" }
  | { kind: "restore" }
  | { kind: "delete" }
  | { kind: "classify"; nodeId: string | null }
  | { kind: "tag"; tagId: string; add: boolean }
  | { kind: "collection"; collectionId: string; add: boolean };

/** Everything the question bank needs from storage. The app uses Supabase; tests use memory. */
export interface QuestionRepo {
  // Questions
  list(query: QuestionQuery): Promise<Page<QuestionRecord>>;
  get(id: string): Promise<QuestionRecord | null>;
  create(inputs: QuestionInput[]): Promise<string[]>;
  update(id: string, input: QuestionInput): Promise<void>;
  bulk(ids: string[], action: BulkAction): Promise<void>;
  versions(id: string): Promise<QuestionVersion[]>;
  /** Content hashes of every question in the bank, for duplicate checks. */
  hashes(): Promise<Set<string>>;
  /** Every active question, for export. */
  exportAll(): Promise<QuestionInput[]>;

  // Taxonomy
  taxonomy(): Promise<TaxonomyNode[]>;
  addNode(parentId: string | null, name: string): Promise<TaxonomyNode>;
  renameNode(id: string, name: string): Promise<void>;
  deleteNode(id: string): Promise<void>;

  // Tags
  tags(): Promise<Tag[]>;
  addTag(name: string): Promise<Tag>;
  renameTag(id: string, name: string): Promise<void>;
  deleteTag(id: string): Promise<void>;

  // Collections
  collections(): Promise<Collection[]>;
  addCollection(name: string): Promise<Collection>;
  renameCollection(id: string, name: string): Promise<void>;
  deleteCollection(id: string): Promise<void>;
}

export const KIND_BY_DEPTH: TaxonomyKind[] = ["subject", "chapter", "topic", "subtopic"];

/** Names from the subject down to this node. */
export function pathOf(nodeId: string | null, nodes: readonly TaxonomyNode[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const names: string[] = [];
  for (let id = nodeId, guard = 0; id && guard < 8; guard++) {
    const n = byId.get(id);
    if (!n) break;
    names.unshift(n.name);
    id = n.parentId;
  }
  return names;
}

/** The node and all nodes below it. */
export function subtreeIds(nodeId: string, nodes: readonly TaxonomyNode[]): string[] {
  const out = [nodeId];
  for (let i = 0; i < out.length; i++) {
    for (const n of nodes) if (n.parentId === out[i]) out.push(n.id);
  }
  return out;
}
