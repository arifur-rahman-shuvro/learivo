import { describe, expect, it } from "vitest";
import { contentHash, md5, normalizeStem } from "./hash.ts";
import { blankQuestion, validateQuestion, type QuestionInput } from "./model.ts";
import {
  analyzeImport,
  exportCsv,
  exportJson,
  parseImportFile,
  rawToQuestion,
} from "./importExport.ts";

const none = new Set<string>();

/** Five options "o1".."o5"; keys say which are correct. */
const five = (keys: boolean[], texts?: string[]) => ({
  options: keys.map((correct, i) => ({ text: texts?.[i] ?? `o${i + 1}`, correct })),
});
const K = (...pos: number[]) => [1, 2, 3, 4, 5].map((n) => pos.includes(n));
const tfq = (stem: string, over: Partial<QuestionInput> = {}): QuestionInput => ({
  ...blankQuestion("true_false"),
  stem,
  answer: five(K(2)),
  ...over,
});

const sba = (over: Partial<QuestionInput> = {}): QuestionInput => ({
  ...blankQuestion("sba"),
  stem: "Which drug inhibits vitamin K dependent factors?",
  answer: five(K(2), ["Aspirin", "Warfarin", "Heparin", "Clopidogrel", "Rivaroxaban"]),
  ...over,
});

describe("md5 and content hash match the database", () => {
  it("matches standard test vectors", () => {
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5("a".repeat(1000))).toBe("cabe45dcc9ae5b66ba86600cca6b8ba8");
  });

  // These expected values were produced by Postgres 16 with the same expression the database uses.
  it("matches values produced by Postgres", () => {
    expect(contentHash("  Which drug  inhibits\tvitamin K?  ", "sba")).toBe(
      "e3d81510cb6f69f2340a4fda8b267e46",
    );
    expect(contentHash("বাংলা প্রশ্ন", "sba")).toBe("c1ed4d74a955fed2d23363e7649883bc");
    expect(contentHash("Line one\nLine   two", "true_false")).toBe(
      "60a455dce2810c25480b8839025e3fd4",
    );
  });

  it("ignores case and extra spaces but not the type", () => {
    expect(normalizeStem("  Hello   WORLD ")).toBe("hello world");
    expect(contentHash("Hello world", "sba")).toBe(contentHash("  HELLO   world ", "sba"));
    expect(contentHash("Hello world", "sba")).not.toBe(contentHash("Hello world", "true_false"));
  });
});

describe("validateQuestion", () => {
  it("accepts a good single best answer question and trims text", () => {
    const r = validateQuestion(sba({ stem: "  Q?  " }));
    expect(r.ok && r.value.stem).toBe("Q?");
  });

  it("requires a statement", () => {
    const r = validateQuestion(sba({ stem: "   " }));
    expect(!r.ok && r.issues[0]!.field).toBe("stem");
  });

  it("requires exactly one correct option for single-answer types", () => {
    for (const q of [sba({ answer: five(K(1, 2)) }), sba({ answer: five(K()) })]) {
      const r = validateQuestion(q);
      expect(!r.ok && r.issues.some((i) => i.message === "Mark exactly one correct option.")).toBe(
        true,
      );
    }
  });

  it("allows several correct options for multiple select but needs one", () => {
    const ok = { ...sba(), qtype: "multi_select" as const, answer: five(K(1, 2)) };
    expect(validateQuestion(ok).ok).toBe(true);
    expect(validateQuestion({ ...ok, answer: five(K()) }).ok).toBe(false);
  });

  it("accepts 2 to 5 options, each with text, and refuses other counts", () => {
    const opts = (n: number, at = 0) => ({
      options: Array.from({ length: n }, (_, i) => ({ text: `o${i + 1}`, correct: i === at })),
    });
    for (const n of [2, 3, 4, 5]) expect(validateQuestion(sba({ answer: opts(n) })).ok).toBe(true);
    expect(validateQuestion(sba({ answer: opts(1) })).ok).toBe(false);
    expect(validateQuestion(sba({ answer: opts(6) })).ok).toBe(false);
    expect(validateQuestion(sba({ answer: five(K(1), ["a", "b", " ", "d", "e"]) })).ok).toBe(false);
    const r = validateQuestion(sba({ answer: opts(1) }));
    expect(!r.ok && r.issues[0]!.message).toBe("Use 2 to 5 options.");
  });

  it("checks true or false (five keyed statements) and fill in the blank", () => {
    expect(validateQuestion(tfq("Heart has-", { answer: five(K(2, 3)) })).ok).toBe(true);
    // all five statements false is a legal key
    expect(validateQuestion(tfq("Heart has-", { answer: five(K()) })).ok).toBe(true);
    expect(validateQuestion(tfq("x", { answer: {} as never })).ok).toBe(false);
    // fewer statements are fine; one statement is not
    expect(
      validateQuestion(tfq("x", { answer: { options: five(K()).options.slice(0, 3) } })).ok,
    ).toBe(true);
    expect(
      validateQuestion(tfq("x", { answer: { options: five(K()).options.slice(0, 1) } })).ok,
    ).toBe(false);
    const fb = {
      ...blankQuestion("fill_blank"),
      stem: "The {{1}} pumps blood.",
      answer: { blanks: [{ accepted: ["heart"] }] },
    };
    expect(validateQuestion(fb).ok).toBe(true);
    const mismatch = { ...fb, stem: "No markers here." };
    const r = validateQuestion(mismatch);
    expect(!r.ok && r.issues[0]!.message).toContain("blank marker");
  });

  it("rejects a difficulty outside 1 to 5 and an impossible exam year", () => {
    expect(validateQuestion(sba({ difficulty: 6 })).ok).toBe(false);
    expect(validateQuestion(sba({ examYear: 1800 })).ok).toBe(false);
  });
});

describe("import: JSON", () => {
  const json = JSON.stringify({
    questions: [
      {
        type: "sba",
        stem: "Q1?",
        options: ["A", "B", "C", "D", "E"],
        correct: 2,
        subject: "Anatomy",
        chapter: "Thorax",
        tags: ["high-yield"],
        difficulty: 3,
      },
      {
        type: "true_or_false",
        stem: "Heart has-",
        options: [
          { text: "5 chambers", correct: false },
          { text: "Pumps blood", correct: true },
          { text: "Is 2 in number", correct: false },
          { text: "Has valves", correct: true },
          { text: "Is a bone", correct: false },
        ],
      },
      {
        type: "multi_select",
        stem: "Q3",
        options: [
          { text: "a", correct: true },
          { text: "b", correct: true },
          { text: "c", correct: false },
          { text: "d", correct: false },
          { text: "e", correct: false },
        ],
      },
      { type: "fill_blank", stem: "The {{1}} and {{2}}", answer: "heart|cardiac;lung" },
    ],
  });

  it("reads all five forms and the taxonomy path", () => {
    const r = analyzeImport(json, "json", none);
    expect(r.ok && r.errors).toEqual([]);
    if (!r.ok) throw new Error("not ok");
    expect(r.rows.map((x) => x.input.qtype)).toEqual([
      "sba",
      "true_false",
      "multi_select",
      "fill_blank",
    ]);
    expect(r.rows[0]!.input.path).toEqual(["Anatomy", "Thorax"]);
    expect(r.rows[0]!.input.answer).toEqual(five(K(2), ["A", "B", "C", "D", "E"]));
    expect(r.rows[1]!.input.answer).toEqual(
      five(K(2, 4), ["5 chambers", "Pumps blood", "Is 2 in number", "Has valves", "Is a bone"]),
    );
    expect(r.rows[3]!.input.answer).toEqual({
      blanks: [{ accepted: ["heart", "cardiac"] }, { accepted: ["lung"] }],
    });
  });

  it("no longer accepts short answer questions", () => {
    const r = analyzeImport(
      JSON.stringify([{ type: "short_answer", stem: "x", answer: "aorta" }]),
      "json",
      none,
    );
    expect(r.ok && r.rows).toHaveLength(0);
    expect(r.ok && r.errors[0]!.message).toContain("Type must be one of");
  });

  it("flags rows that nearly match the bank or an earlier row, but not changed meanings", () => {
    const row = (stem: string) => ({ type: "true_false", stem, options: five(K(1)).options });
    const existing = [
      {
        id: "e1",
        stem: "Which nerve supplies the deltoid muscle of the shoulder?",
        qtype: "true_false",
        options: [],
      },
    ];
    const r = analyzeImport(
      JSON.stringify([
        row("Which nerve supplies the deltoid muscle of the shoulder joint?"),
        row("Which nerve does NOT supply the deltoid muscle of the shoulder?"),
        row("Name the largest organ of the human body"),
        row("Name the largest organ of the human body."),
      ]),
      "json",
      none,
      existing,
    );
    if (!r.ok) throw new Error("not ok");
    expect(r.rows.map((x) => x.similar?.from ?? null)).toEqual(["bank", null, null, "file"]);
  });

  it("accepts a bare list", () => {
    const r = analyzeImport(
      JSON.stringify([{ type: "true_false", stem: "x", options: five(K(1)).options }]),
      "json",
      none,
    );
    expect(r.ok && r.rows.length).toBe(1);
  });

  it("explains problems with the row number and keeps the good rows", () => {
    const bad = JSON.stringify([
      { type: "sba", stem: "ok", options: ["a", "b", "c", "d", "e"], correct: 1 },
      { type: "sba", stem: "", options: ["a", "b", "c", "d", "e"], correct: 1 },
      { type: "poem", stem: "x" },
      { type: "sba", stem: "two correct", options: ["a", "b", "c", "d", "e"], correct: "1;2" },
    ]);
    const r = analyzeImport(bad, "json", none);
    if (!r.ok) throw new Error("not ok");
    expect(r.rows.length).toBe(1);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3, 4]);
    expect(r.errors.find((e) => e.row === 3)!.message).toContain("Type must be one of");
  });

  it("reports unreadable JSON and wrong shape", () => {
    expect(analyzeImport("{ nope", "json", none)).toEqual({
      ok: false,
      message: expect.stringContaining("not valid JSON"),
    });
    expect(analyzeImport('{"a":1}', "json", none).ok).toBe(false);
    expect(analyzeImport("  ", "json", none)).toEqual({ ok: false, message: "The file is empty." });
  });

  it("stops at 5000 questions", () => {
    const big = JSON.stringify(Array.from({ length: 5001 }, () => ({})));
    const r = parseImportFile(big, "json");
    expect(!r.ok && r.message).toContain("5000");
  });

  it("reports a taxonomy gap", () => {
    const r = rawToQuestion(
      { type: "true_false", stem: "x", options: five(K(1)).options, subject: "A", topic: "T" },
      7,
    );
    expect(!r.ok && r.errors[0]).toMatchObject({ row: 7, field: "topic" });
  });
});

describe("import: duplicates", () => {
  it("flags questions already in the bank and repeats inside the file", () => {
    const existing = new Set([contentHash("Already here", "true_false")]);
    const file = JSON.stringify([
      { type: "true_false", stem: "already  HERE", options: five(K(1)).options },
      { type: "true_false", stem: "New one", options: five(K(1)).options },
      { type: "true_false", stem: "new one", options: five(K()).options },
    ]);
    const r = analyzeImport(file, "json", existing);
    if (!r.ok) throw new Error("not ok");
    expect(r.rows.map((x) => x.duplicate)).toEqual(["bank", null, "file"]);
  });
});

describe("import: CSV", () => {
  const csv = [
    "type,stem,explanation,option1,option2,option3,option4,option5,correct,difficulty,subject,chapter,tags,exam_year",
    'sba,"Which is, correctly, a drug?",Because.,Aspirin,Warfarin,Heparin,Statin,Insulin,2,2,Pharmacology,Blood,a;b,2024',
    "true_false,Heart has-,,5 chambers,Pumps blood,Is a bone,Has valves,Is red,2;4,,,,,",
    "",
    "multi_select,Pick,,x,y,z,w,v,1;3,,,,,",
  ].join("\n");

  it("reads columns, quoted commas and blank lines, with line numbers", () => {
    const r = analyzeImport(csv, "csv", none);
    if (!r.ok) throw new Error("not ok");
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.row)).toEqual([2, 3, 5]);
    expect(r.rows[0]!.input.stem).toBe("Which is, correctly, a drug?");
    expect(r.rows[0]!.input.answer).toEqual(
      five(K(2), ["Aspirin", "Warfarin", "Heparin", "Statin", "Insulin"]),
    );
    expect(r.rows[0]!.input).toMatchObject({
      difficulty: 2,
      examYear: 2024,
      path: ["Pharmacology", "Blood"],
      tags: ["a", "b"],
    });
    // for true/false the correct column lists the statements that are True
    expect(r.rows[1]!.input.answer).toEqual(
      five(K(2, 4), ["5 chambers", "Pumps blood", "Is a bone", "Has valves", "Is red"]),
    );
    expect(r.rows[2]!.input.answer).toEqual(five(K(1, 3), ["x", "y", "z", "w", "v"]));
  });

  it("copes with a byte order mark and upper-case headers", () => {
    const r = analyzeImport(
      "\ufeffType,Stem,Option1,Option2,Option3,Option4,Option5,Correct\nsba,Hello?,a,b,c,d,e,3",
      "csv",
      none,
    );
    expect(r.ok && r.rows[0]!.input.answer).toEqual(five(K(3), ["a", "b", "c", "d", "e"]));
  });

  it("reports a row with a bad answer by line number", () => {
    const r = analyzeImport(
      "type,stem,option1,option2,option3,option4,option5,correct\nsba,Q,a,b,c,d,e,",
      "csv",
      none,
    );
    expect(r.ok && r.errors[0]).toMatchObject({ row: 2, field: "answer" });
  });
});

describe("export and round trip", () => {
  const all: QuestionInput[] = [
    sba({
      path: ["Anatomy", "Thorax"],
      tags: ["x", "y"],
      difficulty: 2,
      source: "Book",
      institution: "Uni",
      examName: "Final",
      examYear: 2023,
      explanation: "Because, reasons.\nSecond line.",
    }),
    { ...blankQuestion("multi_select"), stem: "Pick", answer: five(K(1, 2)) },
    tfq("T?", { answer: five(K(1, 3, 5)) }),
    {
      ...blankQuestion("fill_blank"),
      stem: "A {{1}} B {{2}}",
      answer: { blanks: [{ accepted: ["x", "y"] }, { accepted: ["z"] }] },
    },
  ];

  it("JSON export imports back to the same questions", () => {
    const r = analyzeImport(exportJson(all), "json", none);
    if (!r.ok) throw new Error("not ok");
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.input)).toEqual(all);
  });

  it("CSV export imports back to the same questions", () => {
    const r = analyzeImport(exportCsv(all), "csv", none);
    if (!r.ok) throw new Error("not ok");
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.input)).toEqual(all);
  });

  it("protects spreadsheets from formulas and still round-trips", () => {
    const risky = [
      tfq('=HYPERLINK("http://evil")', { source: "+cmd" }),
      tfq("-5 is negative", { tags: ["@me"] }),
    ];
    const out = exportCsv(risky);
    expect(out).toContain("'=HYPERLINK");
    expect(out).toContain("'-5 is negative");
    expect(out).toContain("'+cmd");
    const back = analyzeImport(out, "csv", none);
    if (!back.ok) throw new Error("not ok");
    expect(back.rows.map((x) => x.input.stem)).toEqual(risky.map((q) => q.stem));
    expect(back.rows[0]!.input.source).toBe("+cmd");
  });
});

describe("import: pasted JSON from a chat", () => {
  const one = {
    type: "true_false",
    stem: "The aorta is an artery",
    options: five(K(1)).options,
  };
  const list = JSON.stringify([one], null, 2);

  it("accepts a ```json code block with sentences around it", () => {
    const text = `Here are your questions:\n\n\`\`\`json\n${list}\n\`\`\`\n\nLet me know if you want more!`;
    const r = analyzeImport(text, "json", new Set());
    expect(r.ok && r.rows).toHaveLength(1);
    expect(r.ok && r.notice).toMatch(/code block/);
  });

  it("accepts a list with a sentence in front of it and no code block", () => {
    const r = analyzeImport(`Sure! ${list} Hope that helps.`, "json", new Set());
    expect(r.ok && r.rows).toHaveLength(1);
    expect(r.ok && r.notice).toMatch(/before or after/);
  });

  it("accepts one question on its own", () => {
    const r = analyzeImport(JSON.stringify(one), "json", new Set());
    expect(r.ok && r.rows).toHaveLength(1);
  });

  it("says where the syntax error is", () => {
    const r = analyzeImport(
      '[\n  {"type": "true_false",\n   "stem": "x" "options": []}\n]',
      "json",
      new Set(),
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/not valid JSON.*line \d+, column \d+/);
  });

  it("does not change clean JSON and gives no notice", () => {
    const r = analyzeImport(list, "json", new Set());
    expect(r.ok && r.notice).toBeUndefined();
  });

  it("rejects an empty list", () => {
    const r = analyzeImport("[]", "json", new Set());
    expect(!r.ok && r.message).toMatch(/no questions/);
  });

  it("reports an invalid question by its position and keeps the valid ones", () => {
    const bad = { type: "sba", stem: "No options here" };
    const r = analyzeImport(JSON.stringify([one, bad]), "json", new Set());
    expect(r.ok && r.rows).toHaveLength(1);
    expect(r.ok && r.errors[0]).toMatchObject({ row: 2 });
  });
});
