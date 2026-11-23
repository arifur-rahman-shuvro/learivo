import type { ImportIssue } from "./importExport.ts";
import type { QuestionInput, QuestionType } from "./model.ts";

/** What the student fills in to get a ready-to-paste prompt for an AI chat. */
export interface PromptSpec {
  /** "create": the AI writes new questions. "convert": the AI copies questions from files or photos. */
  mode: "create" | "convert";
  subject: string;
  chapter: string;
  topic: string;
  subtopic: string;
  examName: string;
  institution: string;
  examYear: string;
  source: string;
  /** Comma separated. */
  tags: string;
  /** Question types the AI may use; empty means a mix of all five. */
  types: QuestionType[];
  /** 1 to 5, or "mixed" to let the AI judge each question. */
  difficulty: "mixed" | 1 | 2 | 3 | 4 | 5;
  /** Only used when creating. */
  count: number;
  /** When true the AI decides how many questions the topic needs; `count` is ignored. */
  autoCount: boolean;
  /** How deep the AI goes when it decides the number. */
  coverage: "key" | "standard" | "complete";
  explanation: "none" | "short" | "detailed";
  questionLanguage: string;
  explanationLanguage: string;
  /** For example "MBBS second professional". */
  level: string;
  /** How many options each choice question has; "auto" lets the AI choose 2 to 5. */
  optionCount: "auto" | 2 | 3 | 4 | 5;
  /**
   * How the questions are worded. "exam": the mix a real professional paper uses (mostly direct,
   * some short application, few long cases). "recall": direct questions only. "scenario": mostly cases.
   */
  style: "exam" | "recall" | "scenario";
  /** Anything else the student wants the AI to follow. */
  extra: string;
  /** Notes or text the questions must come from. Not remembered between visits. */
  material: string;
}

/** The most pasted text a prompt carries, so one request stays within what AI services accept. */
export const MATERIAL_MAX = 12000;

export const DEFAULT_SPEC: PromptSpec = {
  mode: "create",
  subject: "",
  chapter: "",
  topic: "",
  subtopic: "",
  examName: "",
  institution: "",
  examYear: "",
  source: "",
  tags: "",
  types: [],
  difficulty: "mixed",
  count: 20,
  autoCount: false,
  coverage: "standard",
  explanation: "short",
  questionLanguage: "English",
  explanationLanguage: "English",
  level: "",
  optionCount: 5,
  style: "exam",
  extra: "",
  material: "",
};

export const PROMPT_TYPES: { id: QuestionType; label: string }[] = [
  { id: "sba", label: "Single best answer (SBA)" },
  { id: "single_choice", label: "Single choice" },
  { id: "multi_select", label: "Multiple answer" },
  { id: "true_false", label: "True / False (several statements)" },
  { id: "fill_blank", label: "Fill in the blank" },
];

/** Most questions per reply; long answers get cut off by chat tools. */
export const BATCH_SIZE = 25;
/** The most questions the AI may decide on for one topic. */
export const COVERAGE_MAX = 120;

export const COVERAGE_LEVELS: { id: PromptSpec["coverage"]; label: string; hint: string }[] = [
  { id: "key", label: "Key points", hint: "Only what real exams test again and again" },
  { id: "standard", label: "Standard", hint: "Everything a student is expected to know" },
  { id: "complete", label: "Complete", hint: "Every testable point, including the rare ones" },
];

function coverageRules(spec: PromptSpec): string[] {
  const depth = {
    key: "KEY POINTS: only the high-yield points that real exams test repeatedly. For a normal topic that is usually about 10 to 25 questions.",
    standard:
      "STANDARD: every point a student is expected to know, weighted by how much real exams test it. For a normal topic that is usually about 25 to 60 questions.",
    complete:
      "COMPLETE: every testable point, including the less common ones. For a normal topic that is usually about 50 to 120 questions.",
  }[spec.coverage];
  return [
    "COVERAGE (you decide the number of questions, I do not):",
    `- Depth: ${depth}`,
    "- The ranges are only a guide. A narrow topic needs fewer questions and a broad one more. Never pad to reach a number, and never leave out a testable point to stay short.",
    `- Hard limit: ${COVERAGE_MAX} questions in total.`,
    "- Weight by exam importance: a point that exams test often or heavily gets more questions (up to 5), a minor point gets one. Stay inside the topic I named.",
  ];
}

/** The prompt that asks the AI only for the coverage plan, used by the in-app writer before it writes. */
export function buildPlanPrompt(spec: PromptSpec): string {
  const about = [spec.subject, spec.chapter, spec.topic, spec.subtopic]
    .map(clean)
    .filter(Boolean)
    .join(" > ");
  const level = clean(spec.level);
  const exam = clean(spec.examName);
  return [
    `You are planning exam questions for a private question bank about: ${about || "the topic I give you"}${level ? `, at the level of: ${level}` : ""}${exam ? `, for the exam: ${exam}` : ""}.`,
    "Do not write any questions yet. List every sub-topic or learning point of this topic that the exam can test, and how many questions each deserves.",
    ...coverageRules(spec),
    "",
    "Reply with JSON only, in one code block, in exactly this shape (at most 30 items):",
    '{"plan": [{"point": "Blood supply of the heart", "questions": 3}]}',
    'Each point is a short phrase. Each "questions" is a whole number from 1 to 5.',
  ].join("\n");
}

/** The rules for the chat route when the AI decides the number: plan first, then batches, then a coverage check. */
function autoRules(): string[] {
  return [
    'PLAN, QUALITY AND LIMITS (these rules stay in force for every reply, including after I say "continue"):',
    "- First reply only: before the code block write PLAN: then a numbered list (at most 30 lines) of every testable point, each with the number of questions you will write for it, then TOTAL: and the total. Do not write the plan again later.",
    `- Then write the first batch in the code block: the first questions of the plan in order, never more than ${BATCH_SIZE} in any reply. Then STOP. Do not carry on past the limit even if you could.`,
    "- Quality beats quantity. Before you include a question, check it: the facts are correct, exactly one option is clearly best, the wrong options are plausible, the stem is clear, and it is not a repeat. Never pad.",
    "- Do not let quality fall in later batches: the last question must be as good as the first. Never repeat or rephrase an earlier question.",
    `- After each code block add one line: NOTE: Batch done, questions A to B of TOTAL. Say continue for the next batch.`,
    `- When I say "continue", write only the next batch (at most ${BATCH_SIZE}) from the plan, then stop and add the same NOTE line.`,
    "- After the last batch add COVERAGE: and one line per plan point with the number of questions written. If any point was left out or cut short, say which and why. Then write nothing more unless I ask.",
  ];
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const tagList = (s: string) =>
  [...new Set(s.split(/[,;]/).map(clean).filter(Boolean))].slice(0, 20);

/** The lines that describe the shared details every question must carry. */
function context(spec: PromptSpec): string[] {
  const rows: [string, string][] = [
    ["subject", clean(spec.subject)],
    ["chapter", clean(spec.chapter)],
    ["topic", clean(spec.topic)],
    ["subtopic", clean(spec.subtopic)],
    ["institution", clean(spec.institution)],
    ["exam_name", clean(spec.examName)],
    ["exam_year", clean(spec.examYear)],
    ["source", clean(spec.source)],
  ];
  const out = rows.filter(([, v]) => v !== "").map(([k, v]) => `- "${k}": ${JSON.stringify(v)}`);
  const tags = tagList(spec.tags);
  out.push(
    tags.length > 0
      ? `- "tags": ${JSON.stringify(tags)} (use exactly these tags and add no others)`
      : '- "tags": [] (I gave no tags: write an empty list and never invent tags)',
  );
  if (spec.difficulty !== "mixed") out.push(`- "difficulty": ${spec.difficulty}`);
  return out;
}

function example(spec: PromptSpec): string {
  const shared: Record<string, unknown> = {};
  if (clean(spec.subject)) shared.subject = clean(spec.subject);
  if (clean(spec.chapter)) shared.chapter = clean(spec.chapter);
  if (clean(spec.topic)) shared.topic = clean(spec.topic);
  if (clean(spec.subtopic)) shared.subtopic = clean(spec.subtopic);
  if (clean(spec.institution)) shared.institution = clean(spec.institution);
  if (clean(spec.examName)) shared.exam_name = clean(spec.examName);
  if (clean(spec.examYear)) shared.exam_year = Number(clean(spec.examYear)) || clean(spec.examYear);
  if (clean(spec.source)) shared.source = clean(spec.source);
  const tags = tagList(spec.tags);
  const diff = spec.difficulty === "mixed" ? 3 : spec.difficulty;
  const opts = (keys: boolean[]) =>
    keys.map((correct, i) => ({ text: `Option ${String.fromCharCode(65 + i)}`, correct }));
  const sba = {
    type: "sba",
    stem: "Question text",
    options: opts(
      Array.from({ length: spec.optionCount === "auto" ? 4 : spec.optionCount }, (_, i) => i === 1),
    ),
    ...(spec.explanation === "none" ? {} : { explanation: "Why the answer is right" }),
    difficulty: diff,
    ...shared,
    tags,
  };
  return JSON.stringify([sba], null, 2);
}

function optionRule(spec: PromptSpec): string {
  return spec.optionCount === "auto"
    ? "between 2 and 5 options (4 or 5 is usual)"
    : `EXACTLY ${spec.optionCount} options`;
}

function typeRules(spec: PromptSpec): string[] {
  const allowed = spec.types.length > 0 ? spec.types : PROMPT_TYPES.map((t) => t.id);
  const lines = [`"type" must be one of: ${allowed.join(", ")}.`];
  if (spec.types.length === 0 || allowed.length > 1) {
    lines.push("Use a sensible mix of these types.");
  }
  const opt = allowed.filter((t) => t !== "fill_blank");
  if (opt.length > 0) {
    lines.push(
      `Every ${opt.join(", ")} question has ${optionRule(spec)}, each with "text" and "correct" (true or false).`,
    );
  }
  if (allowed.includes("sba") || allowed.includes("single_choice")) {
    lines.push('sba and single_choice: exactly ONE option has "correct": true.');
  }
  if (allowed.includes("multi_select")) {
    lines.push(
      "multi_select: one or more options are correct (usually 2 or 3). Never mark every option correct.",
    );
  }
  if (allowed.includes("true_false")) {
    lines.push(
      'true_false: "stem" is a short lead-in (for example "Heart has-") and the options are statements. Set "correct": true for each statement that is TRUE and false for each that is FALSE. Mix true and false statements.',
    );
  }
  if (allowed.includes("fill_blank")) {
    lines.push(
      'fill_blank: write {{1}}, {{2}} in the stem where the blanks go and give "blanks": [["answer for 1", "other accepted spelling"], ["answer for 2"]]. No "options".',
    );
  }
  return lines;
}

function languageLine(spec: PromptSpec): string {
  const q = clean(spec.questionLanguage) || "English";
  const e = clean(spec.explanationLanguage) || q;
  return spec.explanation === "none"
    ? `Write the questions and options in ${q}.`
    : `Write the questions and options in ${q}, and the explanations in ${e}.`;
}

function explanationRule(spec: PromptSpec): string {
  if (spec.explanation === "none") return 'Leave "explanation" out.';
  return spec.explanation === "short"
    ? 'Give every question an "explanation" of one or two sentences saying why the answer is right.'
    : 'Give every question a detailed "explanation": why the answer is right, why the main wrong options are wrong, and one point worth remembering.';
}

/** How questions are worded: real papers are mostly direct, so the default is not scenario-heavy. */
function styleRules(spec: PromptSpec): string[] {
  if (spec.style === "recall") {
    return [
      "- STYLE: direct questions only. Short stems that ask for a fact, a name, a value, a site, a cause, a feature, a classification or a mechanism. Do NOT write patient cases or long scenarios.",
    ];
  }
  if (spec.style === "scenario") {
    return [
      "- STYLE: at least two thirds of the questions present a short scenario, case, data or problem and ask what follows from it. Keep the rest as direct questions.",
    ];
  }
  return [
    "- STYLE: EXAM SIMULATION. Write the questions the way the REAL exam named above (or, if none is named, the real professional exam for this level and subject) writes them. First decide from the exam name, institution, level and subject what that exam is really like, then follow it:",
    "  * Exams that are almost entirely clinical vignettes (for example UKMLA AKT and PLAB 1: single best answer, age, sex, presentation, findings, then the most likely diagnosis, the next best step or the best management, guided by current UK guidance such as NICE; USMLE Step 1 and Step 2 CK; MRCP Part 1): make nearly every question a vignette of that kind.",
    '  * Exams that are mostly direct (for example Bangladesh MBBS professional exams in the basic science years: short stems, true/false items with several statements, single best answer): make about 60 to 70 percent direct questions such as "The nerve supply of ... is", "Drug of choice for ...", "Investigation of choice in ...", "Characteristic feature of ...", "Normal value of ..."; about 20 to 30 percent short application with one or two lines of data; and at most 10 percent full cases (almost none in anatomy, physiology or biochemistry).',
    "  * Mixed exams (for example final professional, NEET-PG, INI-CET, FCPS part 1): roughly half direct or short-application and half clinical cases, leaning clinical for clinical subjects.",
    "  * Use the question formats that exam really uses, within the allowed types: for example UKMLA AKT and PLAB 1 are single best answer only, so use sba and no other type; Bangladesh MBBS papers use true/false items with several statements as well as single best answer. This overrides the general advice to mix types.",
    "  * If you are not sure what the exam is like, use a balanced mix and add one line after the code block starting with NOTE: saying what you assumed. Do not guess a style silently.",
    "  * Set the depth to the exam level: a first-year paper tests core facts and mechanisms, a final or licensing paper tests integration, management and judgement. Never write below or above that level, except as the difficulty rule below says.",
    '  * Vary the wording: do not start more than two questions in a row the same way. "All of the following are true EXCEPT" and "Which of the following is NOT ..." are normal exam wording; use them for at most one question in six, with NOT or EXCEPT in capitals.',
    "  * Never claim that a question was in a past paper.",
  ];
}

/** What separates a real exam question from a weak practice question. Only used when writing new questions. */
function qualityRules(spec: PromptSpec): string[] {
  const rules = [
    "",
    "QUALITY STANDARD",
    "Write like an experienced examiner who sets real papers for this exam, not like a textbook summary.",
    "- One question tests one clear point. The stem holds every fact needed, so a well-prepared student can answer without seeing the options.",
    ...styleRules(spec),
    "- End the stem with a clear question or instruction, or a lead-in that the options complete.",
    "- Every question has ONE defensible correct answer that a standard textbook or guideline supports. Do not invent facts, numbers, drug doses, names or studies. If you are not sure of an answer, either leave that question out and say why in the NOTE line.",
    "- Wrong options (distractors) must be plausible to a student who half-knows the topic: real, related concepts that are wrong for this exact case. Make them similar in length, wording and detail to the correct option. Do not make the correct option the longest or most detailed one.",
    '- No clues: no grammar that gives the answer away, no repeated words from the stem only in the correct option, no overlapping or duplicate options, no "all of the above", "none of the above", "always" or "never". Put the correct option in a different position from question to question.',
    "- Cover the topic widely: no two questions may test the same point or give away each other's answer. Spread them across the subtopics.",
  ];
  if (spec.difficulty === "mixed") {
    rules.push(
      spec.style === "exam"
        ? "- Difficulty mix: most questions (about 65%) at the normal difficulty of the real exam at this level, about 15% easier openers, and about 20% clearly harder than that: the kind that separate the top candidates (several steps of reasoning, close distractors, an unusual presentation of a common topic), never obscure trivia. Rate each question 1 to 5 relative to this exam level, where 3 is the exam's normal level."
        : "- Difficulty mix: about 20% easy (1 to 2), 50% medium (3), 30% hard (4 to 5). Hard means needs reasoning or several steps, not obscure trivia.",
    );
  }
  if (spec.types.length === 0 || spec.types.includes("true_false")) {
    rules.push(
      '- True/false: every statement must be clearly true or clearly false on its own, with no "depends". Mix true and false statements; do not make them all the same.',
    );
  }
  if (spec.types.length === 0 || spec.types.includes("multi_select")) {
    rules.push(
      "- Multiple answer: judge each option separately; each must be clearly correct or clearly wrong.",
    );
  }
  if (spec.types.length === 0 || spec.types.includes("fill_blank")) {
    rules.push(
      "- Fill in the blank: blank out a key term or value, not a trivial word. Each blank has a short answer (one to three words) and list common accepted spellings.",
    );
  }
  if (spec.explanation !== "none") {
    rules.push(
      "- The explanation must agree with the marked answer and teach the point; never write an explanation that supports a different option.",
    );
  }
  if (/bangla|bengali|বাংলা/i.test(`${spec.questionLanguage} ${spec.explanationLanguage}`)) {
    rules.push(
      "- Write natural, exam-style Bangla. Keep standard technical terms in English where students normally use the English term.",
    );
  }
  rules.push(
    "",
    "BEFORE YOU REPLY, CHECK EVERY QUESTION",
    "1. Is the marked answer really correct, and is every other option really wrong?",
    "2. Could a strong student argue for a second answer? If yes, rewrite the question or remove it.",
    "3. Is it a duplicate or near-duplicate of another question in this reply? If yes, replace it.",
    "4. Is the JSON valid: straight double quotes, no trailing commas, no line breaks inside text values (use a space), no markdown inside values?",
  );
  return rules;
}

/** How to write in batches without the quality dropping or the AI running on past the limit. */
function batchRules(total: number): string[] {
  const first = Math.min(total, BATCH_SIZE);
  const rules = [
    `QUALITY AND LIMITS (these rules stay in force for every reply, including after I say "continue"):`,
    `- Write exactly ${first} question${first === 1 ? "" : "s"} in this reply, never more than ${BATCH_SIZE} in any reply. Then STOP. Do not carry on past the limit even if you could.`,
    "- Quality beats quantity. Before you include a question, check it: the facts are correct, exactly one option is clearly best, the wrong options are plausible, the stem is clear, and it is not a repeat. If you cannot write a good question, write fewer and say why in the NOTE line. Never pad.",
    "- Do not let quality fall in later batches: the last question must be as good as the first. Cover different sub-topics and angles, and never repeat or rephrase an earlier question.",
  ];
  if (total > BATCH_SIZE) {
    rules.push(
      `- I need ${total} questions in total, delivered in batches of ${BATCH_SIZE}. After each reply add one line after the code block: NOTE: Batch done, questions A to B of ${total}. Say continue for the next batch.`,
      `- When I say "continue", write only the next batch (at most ${BATCH_SIZE}), then stop and add the same NOTE line. When all ${total} are done, add: NOTE: All ${total} questions done. Write nothing more unless I ask.`,
    );
  } else {
    rules.push("- After the code block add one line: NOTE: Done. Write nothing more unless I ask.");
  }
  return rules;
}

/** The full prompt, ready to paste. Everything the student typed is quoted as plain text, never run. */
export function buildPrompt(spec: PromptSpec): string {
  const lines: string[] = [];
  const level = clean(spec.level);
  const count = Math.max(1, Math.min(200, Math.round(spec.count) || 1));
  const auto = spec.mode === "create" && spec.autoCount;

  if (spec.mode === "create") {
    const about = [
      clean(spec.subject),
      clean(spec.chapter),
      clean(spec.topic),
      clean(spec.subtopic),
    ]
      .filter(Boolean)
      .join(" > ");
    lines.push(
      `You are helping me build a private question bank. Write ${auto ? "exam-style questions" : `${count} exam-style questions`}${about ? ` about: ${about}` : ""}${level ? `, at the level of: ${level}` : ""}.`,
    );
    if (auto) lines.push("", ...coverageRules(spec), "");
    lines.push(
      "If I attached notes, pages or photos, base the questions on them. Otherwise use well-established textbook knowledge only.",
    );
  } else {
    lines.push(
      "I attached photos, screenshots, PDF pages or pasted text that contain exam questions. Copy ALL of them into the format below. Do not write new questions.",
    );
    if (level) lines.push(`The questions are for: ${level}.`);
    lines.push(
      "Keep each question's wording and option order exactly as in the source. Fix only clear typing or scanning mistakes.",
      "Go through the pages in order and do not skip any question.",
    );
  }

  const ctx = context(spec);
  if (ctx.length > 0) {
    lines.push("", "Put these exact values on EVERY question:", ...ctx);
  }

  lines.push("", "RULES", `- ${languageLine(spec)}`, ...typeRules(spec).map((r) => `- ${r}`));
  lines.push(`- ${explanationRule(spec)}`);
  if (spec.difficulty === "mixed") {
    lines.push('- Give each question a "difficulty" from 1 (easy) to 5 (hard).');
  }

  if (spec.mode === "create") {
    lines.push(...qualityRules(spec));
  } else {
    lines.push(
      "- If the source shows the answer key, use it. If it does not, work out the most likely answer yourself and list its question number in a NOTE line after the code block (NOTE: answer worked out by me for questions 3, 7), because you must not add tags.",
      spec.optionCount === "auto"
        ? "- Keep the number of options the source has (2 to 5). Do not add or remove options."
        : `- If a question has fewer than ${spec.optionCount} options, add plausible options to reach exactly ${spec.optionCount} and list its question number in the NOTE line (options added). If it has more, keep the correct option(s) and the ${spec.optionCount} most plausible in total, and list its question number in the NOTE line (options removed).`,
      '- My app cannot store pictures. If a question depends on a picture, diagram or graph, describe what it shows in words inside the question, starting with "[Picture: " and ending with "]".',
      "- True/false is several statements under one lead-in. If the source has single statements, group related ones under a short lead-in.",
    );
  }
  if (clean(spec.extra)) lines.push(`- Also: ${clean(spec.extra)}`);

  const material = spec.material.trim().slice(0, MATERIAL_MAX);
  if (material) {
    lines.push(
      "",
      "SOURCE MATERIAL",
      spec.mode === "create"
        ? "Write the questions only from the text between the two lines of dashes. Do not add facts that are not in it. If it does not hold enough for the number I asked for, write fewer."
        : "The questions to copy are in the text between the two lines of dashes.",
      "-----",
      material,
      "-----",
    );
  }

  lines.push(
    "",
    "OUTPUT",
    auto
      ? "Reply with the PLAN (first reply only), then one list of question objects in a single code block, in exactly this shape:"
      : "Reply with JSON only: one list of question objects in a single code block, in exactly this shape:",
    example(spec),
    "",
    ...(auto
      ? autoRules()
      : spec.mode === "create"
        ? batchRules(count)
        : [
            `Put at most ${BATCH_SIZE} questions in one reply. If there are more, stop after ${BATCH_SIZE} and I will say "continue".`,
          ]),
    'TAGS: use only the tags I listed above, exactly as written. Never add, invent or suggest any other tag (no topic tags, no difficulty tags, no "ai" tags). If I listed none, "tags" is an empty list.',
    "Do not add any text inside the JSON. If you skipped or could not read something, add one line starting with NOTE: after the code block.",
  );
  return lines.join("\n");
}

/** What to send back to the AI when some questions failed the check. */
export function buildFixPrompt(errors: readonly ImportIssue[]): string {
  const byRow = new Map<number, string[]>();
  for (const e of errors) byRow.set(e.row, [...(byRow.get(e.row) ?? []), e.message]);
  const lines = [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, 100)
    .map(([row, msgs]) => `- Question ${row}: ${[...new Set(msgs)].join(" ")}`);
  return [
    "My app rejected these questions from your last answer:",
    ...lines,
    "",
    "Fix only these questions. Keep every other detail the same.",
    "Reply with JSON only: a list containing just the corrected question objects, in the same format as before, in one code block.",
    'Remember: sba, single_choice, multi_select and true_false need 2 to 5 options with "text" and "correct"; sba and single_choice have exactly one correct option; fill_blank uses {{1}} in the stem and a "blanks" list.',
  ].join("\n");
}

export interface Defaults {
  path: string[];
  tags: string[];
  institution: string;
  examName: string;
  examYear: number | null;
  source: string;
}

export const NO_DEFAULTS: Defaults = {
  path: [],
  tags: [],
  institution: "",
  examName: "",
  examYear: null,
  source: "",
};

export const hasDefaults = (d: Defaults) =>
  d.path.length > 0 ||
  d.tags.length > 0 ||
  d.institution !== "" ||
  d.examName !== "" ||
  d.examYear !== null ||
  d.source !== "";

/** Fills details a question lacks; anything the question already has is kept. Tags are added. */
export function applyDefaults(q: QuestionInput, d: Defaults): QuestionInput {
  return {
    ...q,
    path: q.path.length > 0 ? q.path : d.path,
    tags: [...new Set([...q.tags, ...d.tags])],
    institution: q.institution || d.institution,
    examName: q.examName || d.examName,
    examYear: q.examYear ?? d.examYear,
    source: q.source || d.source,
  };
}
