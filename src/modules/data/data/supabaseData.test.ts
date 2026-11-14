import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseData } from "./supabaseData.ts";

type Row = { id: string; user_id: string };

/** A tiny stand-in for the database client: tables of rows, with the calls the class makes. */
function fakeDb(tables: Record<string, Row[]>) {
  const log: string[] = [];
  const db = {
    from(table: string) {
      let mode: "select" | "delete" = "select";
      let owner = "";
      let ids: string[] | null = null;
      let max = Infinity;
      let head = false;
      const run = () => {
        const mine = (tables[table] ?? []).filter((r) => r.user_id === owner || owner === "");
        if (mode === "delete") {
          const before = tables[table]!.length;
          tables[table] = tables[table]!.filter(
            (r) => !(r.user_id === owner && ids!.includes(r.id)),
          );
          log.push(`delete ${table} ${before - tables[table]!.length}`);
          return { data: null, error: null };
        }
        if (head) return { data: null, error: null, count: mine.length };
        return { data: mine.slice(0, max).map((r) => ({ id: r.id })), error: null };
      };
      const q: Record<string, unknown> = {
        select(_c: string, o?: { head?: boolean }) {
          head = !!o?.head;
          return q;
        },
        delete() {
          mode = "delete";
          return q;
        },
        eq(_c: string, v: string) {
          owner = v;
          return q;
        },
        in(_c: string, v: string[]) {
          ids = v;
          return q;
        },
        limit(n: number) {
          max = n;
          return q;
        },
        then: (f: (v: unknown) => unknown) => Promise.resolve(run()).then(f),
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, tables, log };
}

const rows = (user: string, n: number, prefix: string): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, user_id: user }));

describe("SupabaseData", () => {
  it("counts what is stored for the student", async () => {
    const { db } = fakeDb({
      questions: rows("me", 3, "q"),
      attempts: rows("me", 2, "a"),
      exams: [],
      review_cards: rows("me", 1, "c"),
      bookmarks: [],
      notes: rows("me", 4, "n"),
    });
    expect(await new SupabaseData(db, "me").counts()).toEqual({
      questions: 3,
      sessions: 2,
      exams: 0,
      cards: 1,
      bookmarks: 0,
      notes: 4,
    });
  });

  it("clears sessions only, in small batches, and touches nobody else's rows", async () => {
    const { db, tables, log } = fakeDb({
      attempts: [...rows("me", 250, "a"), ...rows("other", 5, "x")],
      questions: rows("me", 10, "q"),
    });
    await new SupabaseData(db, "me").clear("practice");
    expect(tables.attempts!.every((r) => r.user_id === "other")).toBe(true);
    expect(tables.attempts).toHaveLength(5);
    expect(tables.questions).toHaveLength(10);
    expect(log.filter((l) => l.startsWith("delete attempts")).length).toBe(3); // 100 + 100 + 50
  });

  it("deleting all questions keeps sessions; everything removes all of the student's data", async () => {
    const make = () =>
      fakeDb({
        questions: [...rows("me", 1200, "q"), ...rows("other", 3, "y")],
        attempts: rows("me", 4, "a"),
        exams: rows("me", 1, "e"),
        collections: rows("me", 2, "c"),
        tags: rows("me", 2, "t"),
        taxonomy_nodes: rows("me", 3, "n"),
      });
    const a = make();
    await new SupabaseData(a.db, "me").clear("questions");
    expect(a.tables.questions).toHaveLength(3);
    expect(a.tables.attempts).toHaveLength(4);

    const b = make();
    const seen: string[] = [];
    await new SupabaseData(b.db, "me").clear("everything", (s) => seen.push(s));
    for (const t of ["attempts", "exams", "collections", "tags", "taxonomy_nodes"]) {
      expect(b.tables[t]).toHaveLength(0);
    }
    expect(b.tables.questions).toHaveLength(3);
    expect(seen).toEqual(["Sessions", "Questions", "Exams", "Collections", "Tags", "Subjects"]);
  });

  it("explains a failed request in plain words", async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({ limit: () => Promise.resolve({ data: null, error: { message: "boom" } }) }),
        }),
      }),
    } as unknown as SupabaseClient;
    await expect(new SupabaseData(db, "me").clear("practice")).rejects.toThrow(/Could not reach/);
  });
});
