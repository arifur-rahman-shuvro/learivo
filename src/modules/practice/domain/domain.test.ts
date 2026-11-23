import { describe, expect, it } from "vitest";
import { grade, isAnswered, marksFor, normalizeAnswer, tally } from "./grading.ts";
import { applyFilter, checkRules, drawByRules, mulberry32, shuffled } from "./session.ts";
import type { QuestionRecord } from "../../question-bank/data/repo.ts";
import { blankQuestion } from "../../question-bank/domain/model.ts";

const five = (keys: boolean[]) => ({
  options: keys.map((correct, i) => ({ text: `Option ${i + 1}`, correct })),
});
const marks = (o: ReturnType<typeof grade>, mc = 1, mw = 0) => marksFor(o, mc, mw);

describe("grade", () => {
  it("single best answer: all or nothing", () => {
    const one = five([false, true, false, false, false]);
    expect(grade("sba", one, { choices: [1] })).toMatchObject({ verdict: "correct", credit: 1 });
    expect(grade("sba", one, { choices: [0] })).toMatchObject({ verdict: "wrong", credit: 0 });
    expect(grade("sba", one, { choices: [] }).verdict).toBe("unanswered");
    expect(grade("sba", one, null).verdict).toBe("unanswered");
  });

  it("multiple answer with 2 correct: both = 1, one = 0.5", () => {
    const a = five([true, true, false, false, false]);
    expect(marks(grade("multi_select", a, { choices: [0, 1] }))).toBe(1);
    const half = grade("multi_select", a, { choices: [1] });
    expect(half.verdict).toBe("partial");
    expect(marks(half)).toBe(0.5);
  });

  it("multiple answer with 3 correct: one = 0.33, two = 0.67, all = 1", () => {
    const a = five([true, true, true, false, false]);
    expect(marks(grade("multi_select", a, { choices: [2] }))).toBe(0.33);
    expect(marks(grade("multi_select", a, { choices: [0, 2] }))).toBe(0.67);
    expect(marks(grade("multi_select", a, { choices: [2, 1, 0] }))).toBe(1);
  });

  it("multiple answer: a wrong pick cancels a right one, and ticking everything earns nothing", () => {
    const a = five([true, true, false, false, false]);
    expect(marks(grade("multi_select", a, { choices: [0, 3] }))).toBe(0);
    const all = grade("multi_select", a, { choices: [0, 1, 2, 3, 4] });
    expect(all.credit).toBe(0);
    expect(all.verdict).toBe("wrong");
  });

  it("works the same with other option counts", () => {
    const two = five([false, true]);
    expect(grade("sba", two, { choices: [1] }).verdict).toBe("correct");
    const four = five([true, true, true, false]);
    expect(marks(grade("multi_select", four, { choices: [0] }))).toBe(0.33);
    expect(marks(grade("multi_select", four, { choices: [0, 1, 2] }))).toBe(1);
    // three statements: a third of the mark each
    const tf3 = five([true, false, true]);
    expect(marks(grade("true_false", tf3, { marks: [true, false, false] }))).toBe(0.67);
    // four statements: a quarter each
    const tf4 = five([true, false, true, false]);
    expect(marks(grade("true_false", tf4, { marks: [true, false, true, true] }))).toBe(0.75);
  });

  it("true or false: five statements, 0.2 each", () => {
    const a = five([false, true, false, true, true]);
    const answer = (m: boolean[]) => grade("true_false", a, { marks: m });
    expect(marks(answer([false, true, false, true, true]))).toBe(1);
    expect(answer([false, true, false, true, true]).verdict).toBe("correct");
    // three right, two wrong
    const three = answer([false, true, false, false, false]);
    expect(marks(three)).toBe(0.6);
    expect(three.verdict).toBe("partial");
    expect(marks(answer([true, false, true, false, false]))).toBe(0);
    expect(answer([true, false, true, false, false]).verdict).toBe("wrong");
  });

  it("true or false: statements left unmarked earn and lose nothing", () => {
    const a = five([true, true, true, true, true]);
    const o = grade("true_false", a, { marks: [true, true, null, null, false] });
    expect(marksFor(o, 1, 0)).toBe(0.4);
    expect(marksFor(o, 1, 1)).toBe(0.2);
    expect(grade("true_false", a, { marks: [null, null, null, null, null] }).verdict).toBe(
      "unanswered",
    );
  });

  it("fill in the blank needs every blank", () => {
    const a = { blanks: [{ accepted: ["aorta"] }, { accepted: ["vena cava", "IVC"] }] };
    expect(grade("fill_blank", a, { blanks: ["Aorta", "ivc"] }).verdict).toBe("correct");
    expect(grade("fill_blank", a, { blanks: ["Aorta", "x"] }).verdict).toBe("wrong");
    expect(grade("fill_blank", a, { blanks: ["", ""] }).verdict).toBe("unanswered");
  });

  it("a response of the wrong shape is wrong, not a crash", () => {
    const o = grade("true_false", five([true, true, true, true, true]), { choices: [1] });
    expect(o.verdict).toBe("wrong");
  });

  it("normalizes answers", () => {
    expect(normalizeAnswer("  Aorta!! ")).toBe("aorta");
    expect(isAnswered({ blanks: ["", " "] })).toBe(false);
    expect(isAnswered({ marks: [null, false] })).toBe(true);
  });
});

describe("tally and negative marking", () => {
  const right = { verdict: "correct", credit: 1, penalty: 0 } as const;
  const wrong = { verdict: "wrong", credit: 0, penalty: 1 } as const;
  const skip = { verdict: "unanswered", credit: 0, penalty: 0 } as const;

  it("scores with negative marking and never goes below zero", () => {
    const t = tally([right, wrong, wrong, skip], 1, 0.25);
    expect(t).toMatchObject({ correct: 1, wrong: 2, unanswered: 1, score: 0.5, maxScore: 4 });
    expect(t.accuracy).toBeCloseTo(1 / 3);
    expect(tally([wrong, wrong], 1, 1).score).toBe(0);
  });
  it("counts partly correct answers and adds up their marks", () => {
    const a = five([true, true, false, false, false]);
    const outcomes = [
      grade("multi_select", a, { choices: [0] }),
      grade("true_false", five([true, true, true, true, true]), {
        marks: [true, true, true, false, false],
      }),
    ];
    const t = tally(outcomes, 1, 0);
    expect(t).toMatchObject({ partial: 2, correct: 0, score: 1.1 });
  });
  it("negative marking follows the same units", () => {
    // one wrong pick in a 2-answer question costs half of the wrong-answer penalty
    const o = grade("multi_select", five([true, true, false, false, false]), { choices: [0, 3] });
    expect(marksFor(o, 1, 0.5)).toBe(-0.25);
    // two wrong statements of five cost 0.4 of the penalty
    const tf = grade("true_false", five([true, true, true, true, true]), {
      marks: [true, true, true, false, false],
    });
    expect(marksFor(tf, 1, 1)).toBe(0.2);
  });
  it("handles an attempt with no answers", () => {
    expect(tally([skip], 1, 0).accuracy).toBe(0);
  });
  it("marks per item", () => {
    expect(marksFor(right, 2, 0.5)).toBe(2);
    expect(marksFor(wrong, 2, 0.5)).toBe(-0.5);
    expect(marksFor(skip, 2, 0.5)).toBe(0);
  });
});

function q(id: string, nodeId: string | null): QuestionRecord {
  return {
    ...blankQuestion("true_false"),
    answer: five([true, false, true, false, false]),
    stem: id,
    id,
    nodeId,
    status: "active",
    version: 1,
    createdAt: "",
    updatedAt: "",
    tagIds: [],
    collectionIds: [],
  };
}
const inside = (n: string | null, x: QuestionRecord) => n === null || x.nodeId === n;

describe("session building", () => {
  it("shuffles repeatably with a seed and keeps every item", () => {
    const a = shuffled([1, 2, 3, 4, 5, 6], mulberry32(7));
    const b = shuffled([1, 2, 3, 4, 5, 6], mulberry32(7));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("filters unattempted and incorrect questions", () => {
    const pool = [q("a", null), q("b", null), q("c", null)];
    const past = new Map([
      ["a", { last: "correct" as const, times: 2 }],
      ["b", { last: "wrong" as const, times: 1 }],
    ]);
    expect(applyFilter(pool, "unattempted", past).map((x) => x.id)).toEqual(["c"]);
    expect(applyFilter(pool, "incorrect", past).map((x) => x.id)).toEqual(["b"]);
    expect(applyFilter(pool, "all", past)).toHaveLength(3);
  });
  it("warns when a rule cannot be met, counting earlier rules first", () => {
    const pool = [q("a", "x"), q("b", "x"), q("c", "y")];
    const checks = checkRules(
      [
        { nodeId: "x", count: 2 },
        { nodeId: null, count: 3 },
      ],
      pool,
      inside,
    );
    expect(checks[0]).toMatchObject({ available: 2, short: false });
    expect(checks[1]).toMatchObject({ available: 1, short: true });
  });
  it("draws by rules without repeats", () => {
    const pool = [q("a", "x"), q("b", "x"), q("c", "y")];
    const got = drawByRules(
      [
        { nodeId: "x", count: 1 },
        { nodeId: null, count: 5 },
      ],
      pool,
      inside,
      mulberry32(1),
    );
    expect(new Set(got.map((x) => x.id)).size).toBe(got.length);
    expect(got).toHaveLength(3);
  });
});

describe("composeSmart", () => {
  const keep = <T>(xs: readonly T[]) => [...xs];
  const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);

  it("mixes about 40% due, 35% weak and 25% new", async () => {
    const { composeSmart } = await import("./session.ts");
    const out = composeSmart(
      { due: ids("d", 30), weak: ids("w", 30), fresh: ids("f", 30), rest: ids("r", 30) },
      20,
      keep,
    );
    expect(out).toHaveLength(20);
    expect(out.filter((x) => x.startsWith("d"))).toHaveLength(8);
    expect(out.filter((x) => x.startsWith("w"))).toHaveLength(7);
    expect(out.filter((x) => x.startsWith("f"))).toHaveLength(5);
  });

  it("hands a short group's share to the others and never repeats a question", async () => {
    const { composeSmart } = await import("./session.ts");
    const out = composeSmart(
      { due: ["a"], weak: ["a", "b"], fresh: ids("f", 3), rest: ids("r", 30) },
      10,
      keep,
    );
    expect(out).toHaveLength(10);
    expect(new Set(out).size).toBe(10);
    expect(out).toContain("a");
    expect(out).toContain("b");
  });

  it("returns what exists when the bank is small", async () => {
    const { composeSmart } = await import("./session.ts");
    expect(
      composeSmart({ due: [], weak: [], fresh: ["x", "y"], rest: ["x", "y"] }, 20, keep),
    ).toEqual(["x", "y"]);
  });
});

describe("exam focus", () => {
  const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);
  const isE = (x: string) => x.startsWith("e");

  it("draws about half from the focus subjects and still includes the others", async () => {
    const { focusedDraw } = await import("./session.ts");
    const out = focusedDraw([...ids("e", 50), ...ids("o", 50)], 20, isE);
    expect(out).toHaveLength(20);
    expect(out.filter(isE)).toHaveLength(10);
    expect(out.filter((x) => !isE(x))).toHaveLength(10);
  });

  it("fills up from the other side when one side is short", async () => {
    const { focusedDraw } = await import("./session.ts");
    expect(focusedDraw([...ids("e", 3), ...ids("o", 50)], 20, isE).filter(isE)).toHaveLength(3);
    const few = focusedDraw([...ids("e", 50), ...ids("o", 2)], 20, isE);
    expect(few).toHaveLength(20);
    expect(few.filter(isE)).toHaveLength(18);
  });

  it("keeps the Smart mix full and weighted, with no repeats", async () => {
    const { composeSmartFocused } = await import("./session.ts");
    const keep = <T>(xs: readonly T[]) => [...xs];
    const all = [...ids("e", 40), ...ids("o", 40)];
    const out = composeSmartFocused(
      { due: all, weak: all, fresh: all, rest: all },
      20,
      isE,
      0.5,
      keep,
    );
    expect(out).toHaveLength(20);
    expect(new Set(out).size).toBe(20);
    expect(out.filter(isE)).toHaveLength(10);
  });
});
