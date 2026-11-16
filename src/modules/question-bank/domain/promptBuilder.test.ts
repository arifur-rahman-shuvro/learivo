import { describe, expect, it } from "vitest";
import {
  BATCH_SIZE,
  DEFAULT_SPEC,
  NO_DEFAULTS,
  applyDefaults,
  buildFixPrompt,
  buildPrompt,
  hasDefaults,
  type PromptSpec,
} from "./promptBuilder.ts";
import { analyzeImport } from "./importExport.ts";
import { blankQuestion } from "./model.ts";

const spec = (over: Partial<PromptSpec> = {}): PromptSpec => ({ ...DEFAULT_SPEC, ...over });
const none = new Set<string>();

describe("buildPrompt", () => {
  it("puts the student's details on every question and in the example", () => {
    const p = buildPrompt(
      spec({
        subject: "Anatomy",
        chapter: "Thorax",
        topic: "Heart",
        examName: "Final Prof",
        institution: "DMC",
        examYear: "2024",
        tags: "high-yield, cardio",
        difficulty: 3,
        count: 30,
      }),
    );
    expect(p).toContain("Write 30 exam-style questions about: Anatomy > Thorax > Heart");
    expect(p).toContain('- "subject": "Anatomy"');
    expect(p).toContain('- "exam_year": "2024"');
    expect(p).toContain('- "tags": ["high-yield","cardio"]');
    expect(p).toContain('- "difficulty": 3');
    expect(p).toContain('"exam_year": 2024');
    expect(p).toContain(`at most ${BATCH_SIZE} questions`);
  });

  it("asks for the chosen number of options, or lets the AI choose 2 to 5", () => {
    expect(buildPrompt(spec({ optionCount: 4 }))).toContain("EXACTLY 4 options");
    const auto = buildPrompt(spec({ optionCount: "auto" }));
    expect(auto).toContain("between 2 and 5 options");
    expect(auto).not.toContain("EXACTLY");
    const conv = buildPrompt(spec({ mode: "convert", optionCount: 4 }));
    expect(conv).toContain("fewer than 4 options");
    expect(buildPrompt(spec({ mode: "convert", optionCount: "auto" }))).toContain(
      "Keep the number of options the source has",
    );
  });

  it("states the option rules and only the chosen types", () => {
    const p = buildPrompt(spec({ types: ["sba", "true_false"] }));
    expect(p).toContain('"type" must be one of: sba, true_false.');
    expect(p).toContain("EXACTLY 5 options");
    expect(p).toContain("the options are statements");
    expect(p).not.toContain("fill_blank:");
    expect(p).not.toContain("multi_select:");
  });

  it("changes for converting existing questions", () => {
    const p = buildPrompt(spec({ mode: "convert", subject: "Physiology" }));
    expect(p).toContain("I attached photos, screenshots, PDF pages");
    expect(p).toContain("Do not write new questions");
    expect(p).toContain('"check-answer"');
    expect(p).toContain('"had-image"');
    expect(p).not.toContain("exam-style questions");
  });

  it("handles language, explanation level and extra instructions", () => {
    const none_ = buildPrompt(spec({ explanation: "none" }));
    expect(none_).toContain('Leave "explanation" out.');
    expect(none_).not.toContain('"explanation": "Why');
    const long = buildPrompt(
      spec({ explanation: "detailed", explanationLanguage: "Bangla", extra: "Use SI units" }),
    );
    expect(long).toContain("explanations in Bangla");
    expect(long).toContain("detailed");
    expect(long).toContain("- Also: Use SI units");
  });

  it("quotes odd input safely", () => {
    const p = buildPrompt(spec({ subject: 'A "quoted"\nname' }));
    expect(p).toContain('- "subject": "A \\"quoted\\" name"');
  });

  it("produces an example that the importer itself accepts", () => {
    const p = buildPrompt(spec({ subject: "Anatomy", tags: "x" }));
    const json = /```|^\[/m.test(p) ? p.slice(p.indexOf("[\n")) : p;
    const list = json.slice(0, json.lastIndexOf("]") + 1);
    const r = analyzeImport(list, "json", none);
    expect(r.ok && r.errors).toEqual([]);
    expect(r.ok && r.rows).toHaveLength(1);
  });
});

describe("buildFixPrompt", () => {
  it("lists each failing question once with its problems", () => {
    const p = buildFixPrompt([
      { row: 3, field: "options", message: "Use 2 to 5 options." },
      { row: 3, field: "options", message: "Use 2 to 5 options." },
      { row: 1, field: "type", message: "Type must be one of: sba." },
    ]);
    expect(p.indexOf("Question 1")).toBeLessThan(p.indexOf("Question 3"));
    expect(p.match(/Question 3/g)).toHaveLength(1);
    expect(p).toContain("Fix only these questions");
  });
});

describe("applyDefaults", () => {
  const q = { ...blankQuestion("sba"), stem: "S" };
  it("fills only what is missing and adds tags", () => {
    const d = {
      ...NO_DEFAULTS,
      path: ["Anatomy", "Thorax"],
      tags: ["new"],
      examName: "Final",
      examYear: 2024,
    };
    const filled = applyDefaults({ ...q, tags: ["old"] }, d);
    expect(filled).toMatchObject({
      path: ["Anatomy", "Thorax"],
      tags: ["old", "new"],
      examName: "Final",
      examYear: 2024,
    });
    const kept = applyDefaults({ ...q, path: ["Physiology"], examYear: 2020, examName: "Mid" }, d);
    expect(kept).toMatchObject({ path: ["Physiology"], examYear: 2020, examName: "Mid" });
  });
  it("detects when nothing is set", () => {
    expect(hasDefaults(NO_DEFAULTS)).toBe(false);
    expect(hasDefaults({ ...NO_DEFAULTS, source: "x" })).toBe(true);
    expect(applyDefaults(q, NO_DEFAULTS)).toEqual(q);
  });
});

describe("quality standard", () => {
  it("is added when writing new questions, with checks before the reply", () => {
    const p = buildPrompt({ ...DEFAULT_SPEC, subject: "Anatomy" });
    expect(p).toContain("QUALITY STANDARD");
    expect(p).toContain("BEFORE YOU REPLY, CHECK EVERY QUESTION");
    expect(p).toContain("Difficulty mix");
    expect(p).toContain("True/false: every statement");
  });

  it("only mentions rules for the chosen types and a fixed difficulty", () => {
    const p = buildPrompt({ ...DEFAULT_SPEC, types: ["sba"], difficulty: 4 });
    expect(p).not.toContain("Difficulty mix");
    expect(p).not.toContain("True/false: every statement");
    expect(p).not.toContain("Fill in the blank: blank out");
  });

  it("is left out when converting existing questions", () => {
    expect(buildPrompt({ ...DEFAULT_SPEC, mode: "convert" })).not.toContain("QUALITY STANDARD");
  });
});
