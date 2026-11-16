import { TYPE_LABELS, type QuestionInput, type QuestionType } from "./model.ts";

/** What is printed above the questions when the paper is an exam. */
export interface ExamMeta {
  instructions: string;
  /** Null when the exam is untimed. */
  minutes: number | null;
  marksCorrect: number;
  marksWrong: number;
}

export interface PaperOptions {
  title: string;
  /** Adds an answer key on a new page. */
  key: boolean;
  /** Adds each question's explanation to the answer key. */
  explanations: boolean;
  /** Exam details and sections by question type. Left out for a plain list of questions. */
  exam?: ExamMeta;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const letter = (i: number) => String.fromCharCode(65 + i);
const BLANK = /\{\{\s*\d+\s*\}\}/g;

/** The order sections appear in an exam paper. */
export const SECTION_ORDER: QuestionType[] = [
  "sba",
  "single_choice",
  "multi_select",
  "true_false",
  "fill_blank",
];

const DIRECTIONS: Record<QuestionType, string> = {
  sba: "Choose the single best answer.",
  single_choice: "Choose the one correct answer.",
  multi_select: "Choose all the correct answers.",
  true_false: "Mark each statement True or False.",
  fill_blank: "Write the missing word or words in each blank.",
};

function body(q: QuestionInput, grouped: boolean): string {
  const stem = esc(q.stem);
  if (q.qtype === "fill_blank") {
    return `<p class="stem">${esc(q.stem.replace(BLANK, "__________"))}</p>`;
  }
  const o = "options" in q.answer ? q.answer.options : [];
  if (q.qtype === "true_false") {
    return (
      `<p class="stem">${stem}</p><ol class="opts tf" type="a">` +
      o.map((x) => `<li><span class="tfbox">True / False</span> ${esc(x.text)}</li>`).join("") +
      "</ol>"
    );
  }
  // Inside a section the direction is already given, so repeat it only on a plain list.
  const hint =
    q.qtype === "multi_select" && !grouped ? '<p class="hint">Choose all that apply.</p>' : "";
  return (
    `<p class="stem">${stem}</p>${hint}<ol class="opts" type="A">` +
    o.map((x) => `<li>${esc(x.text)}</li>`).join("") +
    "</ol>"
  );
}

/** The answer in a short, printable form. */
export function answerText(q: QuestionInput): string {
  if ("blanks" in q.answer) {
    return q.answer.blanks
      .map((b, i) => `${i + 1}) ${b.accepted.filter(Boolean).join(" / ")}`)
      .join("   ");
  }
  const o = q.answer.options;
  if (q.qtype === "true_false") {
    return o
      .map((x, i) => `${letter(i).toLowerCase()}) ${x.correct ? "True" : "False"}`)
      .join("   ");
  }
  return (
    o
      .map((x, i) => (x.correct ? letter(i) : ""))
      .filter(Boolean)
      .join(", ") || "-"
  );
}

/** Questions grouped into sections by type, in the fixed order. Order inside a section is kept. */
export function sectionsOf(questions: readonly QuestionInput[]) {
  return SECTION_ORDER.map((type) => ({
    type,
    questions: questions.filter((q) => q.qtype === type),
  })).filter((s) => s.questions.length > 0);
}

const STYLE = `
@page { margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: Georgia, "Times New Roman", serif; color: #000; background: #fff; font-size: 12pt; line-height: 1.45; margin: 0; padding: 12px; }
h1 { font-size: 18pt; margin: 0 0 6px; text-align: center; }
h2 { font-size: 14pt; margin: 0 0 10px; }
h3 { font-size: 12.5pt; margin: 18px 0 2px; border-bottom: 1px solid #000; padding-bottom: 2px; break-after: avoid; }
.dir { margin: 0 0 10px; font-style: italic; font-size: 10.5pt; }
.facts { text-align: center; margin: 0 0 6px; font-size: 11pt; }
.instr { margin: 8px 0; white-space: pre-wrap; font-size: 11pt; }
.meta { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin: 10px 0 12px; font-size: 11pt; }
.q { break-inside: avoid; margin: 0 0 16px; }
.num { font-weight: bold; }
.stem { margin: 0 0 4px; white-space: pre-wrap; display: inline; }
.hint { margin: 0 0 4px; font-style: italic; font-size: 10.5pt; }
.opts { margin: 4px 0 0; padding-left: 26px; }
.opts li { margin: 2px 0; white-space: pre-wrap; }
.tfbox { display: inline-block; border: 1px solid #000; padding: 0 5px; margin-right: 6px; font-size: 9.5pt; }
.key { break-before: page; }
.key li { margin: 0 0 6px; }
.why { display: block; font-size: 10.5pt; color: #222; white-space: pre-wrap; }
`;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const marks = (n: number) => String(Math.round(n * 100) / 100);

function examHeader(count: number, m: ExamMeta): string {
  const total = marks(count * m.marksCorrect);
  const facts = [
    plural(count, "question"),
    `Total marks: ${total}`,
    m.minutes ? `Time: ${m.minutes} minutes` : "No time limit",
  ];
  const scheme =
    `${marks(m.marksCorrect)} ${m.marksCorrect === 1 ? "mark" : "marks"} for each correct answer` +
    (m.marksWrong > 0 ? `; ${marks(m.marksWrong)} deducted for each wrong answer.` : ".");
  return (
    `<p class="facts">${esc(facts.join("   |   "))}</p><p class="facts">${esc(scheme)}</p>` +
    (m.instructions.trim() ? `<p class="instr">${esc(m.instructions)}</p>` : "")
  );
}

/** A complete, self-contained page that prints cleanly. Everything typed by the student is escaped. */
export function paperHtml(questions: readonly QuestionInput[], opts: PaperOptions): string {
  const title = opts.title.trim() || "Question paper";
  const ordered = opts.exam ? sectionsOf(questions).flatMap((s) => s.questions) : [...questions];
  let n = 0;
  const item = (q: QuestionInput, grouped: boolean) =>
    `<section class="q"><span class="num">${++n}.</span> ${body(q, grouped)}</section>`;

  const items = opts.exam
    ? sectionsOf(questions)
        .map((s, i) => {
          const each = marks(opts.exam!.marksCorrect);
          return (
            `<h3>Section ${letter(i)}: ${esc(TYPE_LABELS[s.type])} (${plural(s.questions.length, "question")}, ${each} each)</h3>` +
            `<p class="dir">${esc(DIRECTIONS[s.type])}</p>` +
            s.questions.map((q) => item(q, true)).join("\n")
          );
        })
        .join("\n")
    : ordered.map((q) => item(q, false)).join("\n");

  const key = opts.key
    ? `<section class="key"><h2>Answer key</h2><ol>${ordered
        .map(
          (q) =>
            `<li>${esc(answerText(q))}${
              opts.explanations && q.explanation.trim()
                ? `<span class="why">${esc(q.explanation)}</span>`
                : ""
            }</li>`,
        )
        .join("")}</ol></section>`
    : "";
  const meta = `<div class="meta"><span>Name: ____________________</span><span>Date: ____________</span><span>${opts.exam ? "Roll / ID: ________" : `Questions: ${questions.length}`}</span></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body><h1>${esc(title)}</h1>${opts.exam ? examHeader(questions.length, opts.exam) : ""}${meta}${items}${key}</body></html>`;
}
