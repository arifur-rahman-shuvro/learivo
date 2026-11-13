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

const sba = (over: Partial<QuestionInput> = {}): QuestionInput => ({
  ...blankQuestion("sba"),
  stem: "Which drug inhibits vitamin K dependent factors?",
  answer: {
    options: [
      { text: "Aspirin", correct: false },
      { text: "Warfarin", correct: true },
      { text: "Heparin", correct: false },
    ],
  },
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
    const two = sba({
      answer: {
        options: [
          { text: "a", correct: true },
          { text: "b", correct: true },
        ],
      },
    });
    const none_ = sba({
      answer: {
        options: [
          { text: "a", correct: false },
          { text: "b", correct: false },
        ],
      },
    });
    for (const q of [two, none_]) {
      const r = validateQuestion(q);
      expect(!r.ok && r.issues.some((i) => i.message === "Mark exactly one correct option.")).toBe(
        true,
      );
    }
  });

  it("allows several correct options for multiple select but needs one", () => {
    const ok = {
      ...sba(),
      qtype: "multi_select" as const,
      answer: {
        options: [
          { text: "a", correct: true },
          { text: "b", correct: true },
        ],
      },
    };
    expect(validateQuestion(ok).ok).toBe(true);
    const bad = {
      ...ok,
      answer: {
        options: [
          { text: "a", correct: false },
          { text: "b", correct: false },
        ],
      },
    };
    expect(validateQuestion(bad).ok).toBe(false);
  });

  it("rejects too few options and empty option text", () => {
    expect(validateQuestion(sba({ answer: { options: [{ text: "a", correct: true }] } })).ok).toBe(
      false,
    );
    expect(
      validateQuestion(
        sba({
          answer: {
            options: [
              { text: "a", correct: true },
              { text: " ", correct: false },
            ],
          },
        }),
      ).ok,
    ).toBe(false);
  });

  it("checks true or false, short answer and fill in the blank", () => {
    expect(
      validateQuestion({ ...blankQuestion("true_false"), stem: "Heart has 4 chambers." }).ok,
    ).toBe(true);
    expect(
      validateQuestion({ ...blankQuestion("true_false"), stem: "x", answer: {} as never }).ok,
    ).toBe(false);
    expect(
      validateQuestion({
        ...blankQuestion("short_answer"),
        stem: "Largest artery?",
        answer: { accepted: ["aorta"] },
      }).ok,
    ).toBe(true);
    expect(validateQuestion({ ...blankQuestion("short_answer"), stem: "q" }).ok).toBe(false);
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
        options: ["A", "B", "C"],
        correct: 2,
        subject: "Anatomy",
        chapter: "Thorax",
        tags: ["high-yield"],
        difficulty: 3,
      },
      { type: "true_or_false", stem: "Q2", answer: "yes" },
      {
        type: "multi_select",
        stem: "Q3",
        options: [
          { text: "a", correct: true },
          { text: "b", correct: true },
          { text: "c", correct: false },
        ],
      },
      { type: "short_answer", stem: "Q4", answer: "aorta|the aorta" },
      { type: "fill_blank", stem: "The {{1}} and {{2}}", answer: "heart|cardiac;lung" },
    ],
  });

  it("reads all six forms and the taxonomy path", () => {
    const r = analyzeImport(json, "json", none);
    expect(r.ok && r.errors).toEqual([]);
    if (!r.ok) throw new Error("not ok");
    expect(r.rows.map((x) => x.input.qtype)).toEqual([
      "sba",
      "true_false",
      "multi_select",
      "short_answer",
      "fill_blank",
    ]);
    expect(r.rows[0]!.input.path).toEqual(["Anatomy", "Thorax"]);
    expect(r.rows[0]!.input.answer).toEqual({
      options: [
        { text: "A", correct: false },
        { text: "B", correct: true },
        { text: "C", correct: false },
      ],
    });
    expect(r.rows[1]!.input.answer).toEqual({ answer: true });
    expect(r.rows[3]!.input.answer).toEqual({ accepted: ["aorta", "the aorta"] });
    expect(r.rows[4]!.input.answer).toEqual({
      blanks: [{ accepted: ["heart", "cardiac"] }, { accepted: ["lung"] }],
    });
  });

  it("accepts a bare list", () => {
    const r = analyzeImport(
      JSON.stringify([{ type: "true_false", stem: "x", answer: false }]),
      "json",
      none,
    );
    expect(r.ok && r.rows.length).toBe(1);
  });

  it("explains problems with the row number and keeps the good rows", () => {
    const bad = JSON.stringify([
      { type: "sba", stem: "ok", options: ["a", "b"], correct: 1 },
      { type: "sba", stem: "", options: ["a", "b"], correct: 1 },
      { type: "poem", stem: "x" },
      { type: "sba", stem: "two correct", options: ["a", "b"], correct: "1;2" },
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
      { type: "true_false", stem: "x", answer: true, subject: "A", topic: "T" },
      7,
    );
    expect(!r.ok && r.errors[0]).toMatchObject({ row: 7, field: "topic" });
  });
});

describe("import: duplicates", () => {
  it("flags questions already in the bank and repeats inside the file", () => {
    const existing = new Set([contentHash("Already here", "true_false")]);
    const file = JSON.stringify([
      { type: "true_false", stem: "already  HERE", answer: true },
      { type: "true_false", stem: "New one", answer: true },
      { type: "true_false", stem: "new one", answer: false },
    ]);
    const r = analyzeImport(file, "json", existing);
    if (!r.ok) throw new Error("not ok");
    expect(r.rows.map((x) => x.duplicate)).toEqual(["bank", null, "file"]);
  });
});

describe("import: CSV", () => {
  const csv = [
    "type,stem,explanation,option1,option2,option3,correct,answer,difficulty,subject,chapter,tags,exam_year",
    'sba,"Which is, correctly, a drug?",Because.,Aspirin,Warfarin,Heparin,2,,2,Pharmacology,Blood,a;b,2024',
    "true_false,The heart has 4 chambers,,,,,,true,,,,,",
    "short_answer,Largest artery?,,,,,,aorta|the aorta,,,,,",
    "",
    "multi_select,Pick,,x,y,z,1;3,,,,,,",
  ].join("\n");

  it("reads columns, quoted commas and blank lines, with line numbers", () => {
    const r = analyzeImport(csv, "csv", none);
    if (!r.ok) throw new Error("not ok");
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.row)).toEqual([2, 3, 4, 6]);
    expect(r.rows[0]!.input.stem).toBe("Which is, correctly, a drug?");
    expect(r.rows[0]!.input.answer).toEqual({
      options: [
        { text: "Aspirin", correct: false },
        { text: "Warfarin", correct: true },
        { text: "Heparin", correct: false },
      ],
    });
    expect(r.rows[0]!.input).toMatchObject({
      difficulty: 2,
      examYear: 2024,
      path: ["Pharmacology", "Blood"],
      tags: ["a", "b"],
    });
    expect(r.rows[3]!.input.answer).toEqual({
      options: [
        { text: "x", correct: true },
        { text: "y", correct: false },
        { text: "z", correct: true },
      ],
    });
  });

  it("copes with a byte order mark and upper-case headers", () => {
    const r = analyzeImport("﻿Type,Stem,Answer\ntrue_false,Hello?,false", "csv", none);
    expect(r.ok && r.rows[0]!.input.answer).toEqual({ answer: false });
  });

  it("reports a row with a bad answer by line number", () => {
    const r = analyzeImport("type,stem,option1,option2,correct\nsba,Q,a,b,", "csv", none);
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
    {
      ...blankQuestion("multi_select"),
      stem: "Pick",
      answer: {
        options: [
          { text: "a", correct: true },
          { text: "b", correct: true },
          { text: "c", correct: false },
        ],
      },
    },
    { ...blankQuestion("true_false"), stem: "T?", answer: { answer: false } },
    { ...blankQuestion("short_answer"), stem: "S?", answer: { accepted: ["one", "two"] } },
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
      {
        ...blankQuestion("true_false"),
        stem: '=HYPERLINK("http://evil")',
        answer: { answer: true },
        source: "+cmd",
      },
      {
        ...blankQuestion("true_false"),
        stem: "-5 is negative",
        answer: { answer: true },
        tags: ["@me"],
      },
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
    answer: true,
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
      '[\n  {"type": "true_false",\n   "stem": "x" "answer": true}\n]',
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
