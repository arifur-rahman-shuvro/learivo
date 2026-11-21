import { describe, expect, it, vi } from "vitest";
import { reportError } from "./monitoring.ts";
import { UnexpectedDataError, checkRow, checkRows, opt, type RowSpec } from "./rowCheck.ts";

vi.mock("./monitoring.ts", () => ({ reportError: vi.fn() }));

const spec: RowSpec = {
  id: "string",
  version: "number",
  status: ["active", "archived"],
  answer: "object",
  tags: "array",
  score: "numeric",
  note: opt("string"),
};
const good = {
  id: "q1",
  version: 2,
  status: "active",
  answer: { options: [] },
  tags: [],
  score: "3.5",
};

describe("checkRow", () => {
  it("returns a row that fits, including optional fields that are null or missing", () => {
    expect(checkRow("questions", good, spec)).toBe(good);
    expect(checkRow("questions", { ...good, note: null }, spec)).toBeTruthy();
    expect(checkRow("questions", { ...good, note: "hi" }, spec)).toBeTruthy();
  });

  it("accepts numeric columns as numbers or numeric strings, and rejects other text", () => {
    expect(checkRow("t", { ...good, score: 4 }, spec)).toBeTruthy();
    expect(() => checkRow("t", { ...good, score: "abc" }, spec)).toThrow(UnexpectedDataError);
    expect(() => checkRow("t", { ...good, score: "" }, spec)).toThrow(UnexpectedDataError);
  });

  it("rejects a missing field, a wrong kind and a value outside the allowed list", () => {
    const noId: Record<string, unknown> = { ...good };
    delete noId.id;
    expect(() => checkRow("questions", noId, spec)).toThrow(UnexpectedDataError);
    expect(() => checkRow("questions", { ...good, version: "2" }, spec)).toThrow();
    expect(() => checkRow("questions", { ...good, status: "deleted" }, spec)).toThrow();
    expect(() => checkRow("questions", { ...good, answer: [] }, spec)).toThrow();
    expect(() => checkRow("questions", { ...good, tags: {} }, spec)).toThrow();
    expect(() => checkRow("questions", { ...good, note: 5 }, spec)).toThrow();
    expect(() => checkRow("questions", null, spec)).toThrow();
  });

  it("names the table and field, never the value, and tells monitoring the same", () => {
    try {
      checkRow("questions", { ...good, id: 12345 }, spec);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(UnexpectedDataError);
      const err = e as UnexpectedDataError;
      expect([err.table, err.field]).toEqual(["questions", "id"]);
      expect(err.message).not.toContain("12345");
    }
    const sent = vi.mocked(reportError).mock.calls.map((c) => String((c[0] as Error).message));
    expect(sent).toContain("Unexpected data from questions.id");
    expect(sent.join(" ")).not.toContain("12345");
  });
});

describe("checkRows", () => {
  it("treats no rows as an empty list and checks every row", () => {
    expect(checkRows("t", null, spec)).toEqual([]);
    expect(checkRows("t", [good, good], spec)).toHaveLength(2);
    expect(() => checkRows("t", [good, { ...good, id: 1 }], spec)).toThrow(UnexpectedDataError);
    expect(() => checkRows("t", "nope", spec)).toThrow(UnexpectedDataError);
  });
});
