import type { ImportIssue } from "./importExport.ts";
import type { QuestionInput, QuestionType } from "./model.ts";

/** What the student fills in to get a ready-to-paste prompt for ChatGPT (or any AI chat). */
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
  explanation: "none" | "short" | "detailed";
  questionLanguage: string;
  explanationLanguage: string;
  /** For example "MBBS second professional". */
  level: string;
  /** How many options each choice question has; "auto" lets the AI choose 2 to 5. */
  optionCount: "auto" | 2 | 3 | 4 | 5;
  /** Anything else the student wants the AI to follow. */
  extra: string;
}

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
  explanation: "short",
  questionLanguage: "English",
  explanationLanguage: "English",
  level: "",
  optionCount: 5,
  extra: "",
};

export const PROMPT_TYPES: { id: QuestionType; label: string }[] = [
  { id: "sba", label: "Single best answer (SBA)" },
  { id: "single_choice", label: "Single choice" },
  { id: "multi_select", label: "Multiple answer" },
  { id: "true_false", label: "True / False (several statements)" },
  { id: "fill_blank", label: "Fill in the blank" },
];

/** Marker tags the AI adds when it is unsure, so the student can find and check those questions. */
export const CHECK_TAGS = ["check-answer", "check-options", "had-image"] as const;

/** Most questions per reply; long answers get cut off by chat tools. */
export const BATCH_SIZE = 25;

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
  if (tags.length > 0) out.push(`- "tags": ${JSON.stringify(tags)} (you may add more tags)`);
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
    tags: tags.length > 0 ? tags : ["tag"],
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

/** What separates a real exam question from a weak practice question. Only used when writing new questions. */
function qualityRules(spec: PromptSpec): string[] {
  const rules = [
    "",
    "QUALITY STANDARD",
    "Write like an experienced examiner who sets real papers for this exam, not like a textbook summary.",
    "- One question tests one clear point. The stem holds every fact needed, so a well-prepared student can answer without seeing the options.",
    "- Prefer application over recall: at least half of the questions should present a short scenario, case, data or problem and ask what follows from it. Use plain recall only for essential facts.",
    "- End the stem with a clear question or instruction. Word it positively; avoid NOT or EXCEPT unless the point really needs it, and then write the word in capitals.",
    '- Every question has ONE defensible correct answer that a standard textbook or guideline supports. Do not invent facts, numbers, drug doses, names or studies. If you are not sure of an answer, either leave that question out or tag it "check-answer".',
    "- Wrong options (distractors) must be plausible to a student who half-knows the topic: real, related concepts that are wrong for this exact case. Make them similar in length, wording and detail to the correct option. Do not make the correct option the longest or most detailed one.",
    '- No clues: no grammar that gives the answer away, no repeated words from the stem only in the correct option, no overlapping or duplicate options, no "all of the above", "none of the above", "always" or "never". Put the correct option in a different position from question to question.',
    "- Cover the topic widely: no two questions may test the same point or give away each other's answer. Spread them across the subtopics.",
  ];
  if (spec.difficulty === "mixed") {
    rules.push(
      "- Difficulty mix: about 20% easy (1 to 2), 50% medium (3), 30% hard (4 to 5). Hard means needs reasoning or several steps, not obscure trivia.",
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

/** The full prompt, ready to paste. Everything the student typed is quoted as plain text, never run. */
export function buildPrompt(spec: PromptSpec): string {
  const lines: string[] = [];
  const level = clean(spec.level);
  const count = Math.max(1, Math.min(200, Math.round(spec.count) || 1));

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
      `You are helping me build a private question bank. Write ${count} exam-style questions${about ? ` about: ${about}` : ""}${level ? `, at the level of: ${level}` : ""}.`,
    );
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
      '- If the source shows the answer key, use it. If it does not, work out the most likely answer yourself and add the tag "check-answer".',
      spec.optionCount === "auto"
        ? "- Keep the number of options the source has (2 to 5). Do not add or remove options."
        : `- If a question has fewer than ${spec.optionCount} options, add plausible options to reach exactly ${spec.optionCount} and add the tag "check-options". If it has more, keep the correct option(s) and the ${spec.optionCount} most plausible in total, and add the tag "check-options".`,
      '- My app cannot store pictures. If a question depends on a picture, diagram or graph, describe what it shows in words inside the question, starting with "[Picture: " and ending with "]", and add the tag "had-image".',
      "- True/false is several statements under one lead-in. If the source has single statements, group related ones under a short lead-in.",
    );
  }
  if (clean(spec.extra)) lines.push(`- Also: ${clean(spec.extra)}`);

  lines.push(
    "",
    "OUTPUT",
    "Reply with JSON only: one list of question objects in a single code block, in exactly this shape:",
    example(spec),
    "",
    `Put at most ${BATCH_SIZE} questions in one reply. If there are more, stop after ${BATCH_SIZE} and I will say "continue".`,
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
