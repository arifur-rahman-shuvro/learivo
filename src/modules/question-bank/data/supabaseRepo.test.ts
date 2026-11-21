import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UnexpectedDataError } from "../../../core/rowCheck.ts";
import { SupabaseRepo } from "./supabaseRepo.ts";

vi.mock("../../../core/monitoring.ts", () => ({ reportError: vi.fn() }));

/** A stand-in database client that answers each table with its own rows. */
function stub(tables: Record<string, unknown>): SupabaseClient {
  let table = "";
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit", "range", "eq"]) chain[m] = () => chain;
  chain.from = (t: string) => {
    table = t;
    return chain;
  };
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: tables[table] ?? [], error: null });
  return chain as unknown as SupabaseClient;
}

const TF = { options: [{ text: "a", correct: true }] };
const snapshot = { qtype: "true_false", stem: "S", answer_spec: TF };

describe("SupabaseRepo rows", () => {
  it("reads collections and version history shaped like the database's", async () => {
    const db = stub({
      collections: [{ id: "c1", name: "Mock", collection_questions: [{ count: 3 }] }],
      question_versions: [{ version: 2, created_at: "2026-01-01T00:00:00Z", snapshot }],
    });
    const repo = new SupabaseRepo(db, "u");
    expect(await repo.collections()).toEqual([{ id: "c1", name: "Mock", count: 3 }]);
    const [v] = await repo.versions("q1");
    // An old snapshot without the later columns still shows, with blanks.
    expect(v!.question).toMatchObject({ stem: "S", explanation: "", source: "", examYear: null });
  });

  it("stops on a collection or a version snapshot that lacks what the app needs", async () => {
    await expect(
      new SupabaseRepo(stub({ collections: [{ id: "c1", name: "M" }] }), "u").collections(),
    ).rejects.toMatchObject({ table: "collections", field: "collection_questions" });
    await expect(
      new SupabaseRepo(
        stub({
          question_versions: [{ version: 1, created_at: "2026-01-01T00:00:00Z", snapshot: {} }],
        }),
        "u",
      ).versions("q1"),
    ).rejects.toBeInstanceOf(UnexpectedDataError);
    await expect(
      new SupabaseRepo(
        stub({ question_versions: [{ version: "1", created_at: "x", snapshot }] }),
        "u",
      ).versions("q1"),
    ).rejects.toMatchObject({ table: "question_versions", field: "version" });
  });
});
