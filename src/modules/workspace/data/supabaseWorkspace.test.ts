import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UnexpectedDataError } from "../../../core/rowCheck.ts";
import { SupabaseWorkspace } from "./supabaseWorkspace.ts";

vi.mock("../../../core/monitoring.ts", () => ({ reportError: vi.fn() }));

/** A stand-in database client: every query method returns the same object, and awaiting it gives `data`. */
function stub(data: unknown): SupabaseClient {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "select", "order", "limit", "range", "eq"]) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error: null });
  return chain as unknown as SupabaseClient;
}

const note = {
  id: "n1",
  question_id: null,
  title: "T",
  body: "B",
  updated_at: "2026-01-01T00:00:00Z",
};
const card = {
  question_id: "q1",
  state: "review",
  due: "2026-02-01T00:00:00Z",
  stability: "3.2",
  difficulty: 5,
  reps: 2,
  lapses: 0,
  last_review: null,
};

describe("SupabaseWorkspace rows", () => {
  it("reads rows shaped like the database's, including numeric columns that arrive as text", async () => {
    expect(await new SupabaseWorkspace(stub([note]), "u").notes()).toHaveLength(1);
    const cards = await new SupabaseWorkspace(stub([card]), "u").cards();
    expect(cards[0]!.stability).toBe(3.2);
    const terms = await new SupabaseWorkspace(
      stub([{ id: "g1", term: "Ischaemia", definition: "Low blood supply" }]),
      "u",
    ).glossary();
    expect(terms[0]!.term).toBe("Ischaemia");
  });

  it("stops on rows that lack what the app needs, naming the table", async () => {
    await expect(
      new SupabaseWorkspace(stub([{ ...note, title: null }]), "u").notes(),
    ).rejects.toBeInstanceOf(UnexpectedDataError);
    await expect(
      new SupabaseWorkspace(stub([{ ...card, state: "learning" }]), "u").cards(),
    ).rejects.toMatchObject({ table: "review_cards", field: "state" });
    await expect(
      new SupabaseWorkspace(stub([{ id: "g1", term: "x" }]), "u").glossary(),
    ).rejects.toMatchObject({ table: "glossary_terms", field: "definition" });
  });
});
