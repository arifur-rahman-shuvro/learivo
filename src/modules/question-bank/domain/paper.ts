import type { QuestionInput } from "./model.ts";

export interface PaperOptions {
  title: string;
  /** Adds an answer key on a new page. */
  key: boolean;
  /** Adds each question's explanation to the answer key. */
  explanations: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const letter = (i: number) => String.fromCharCode(65 + i);
const BLANK = /\{\{\s*\d+\s*\}\}/g;

function body(q: QuestionInput): string {
  const stem = esc(q.stem);
  if (q.qtype === "fill_blank")
    return `<p class="stem">${esc(q.stem.replace(BLANK, "__________"))}</p>`;
  const o = "options" in q.answer ? q.answer.options : [];
  if (q.qtype === "true_false") {
    return (
      `<p class="stem">${stem}</p><ol class="opts tf">` +
      o.map((x) => `<li><span class="tfbox">True / False</span> ${esc(x.text)}</li>`).join("") +
      "</ol>"
    );
  }
  const hint = q.qtype === "multi_select" ? '<p class="hint">Choose all that apply.</p>' : "";
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
    return o.map((x, i) => `${i + 1}) ${x.correct ? "True" : "False"}`).join("   ");
  }
  return (
    o
      .map((x, i) => (x.correct ? letter(i) : ""))
      .filter(Boolean)
      .join(", ") || "-"
  );
}

const STYLE = `
@page { margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: Georgia, "Times New Roman", serif; color: #000; background: #fff; font-size: 12pt; line-height: 1.45; margin: 0; padding: 12px; }
h1 { font-size: 18pt; margin: 0 0 6px; text-align: center; }
h2 { font-size: 14pt; margin: 0 0 10px; }
.meta { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin: 10px 0 16px; font-size: 11pt; }
.q { break-inside: avoid; margin: 0 0 16px; }
.num { font-weight: bold; }
.stem { margin: 0 0 4px; white-space: pre-wrap; }
.hint { margin: 0 0 4px; font-style: italic; font-size: 10.5pt; }
.opts { margin: 0; padding-left: 26px; }
.opts li { margin: 2px 0; white-space: pre-wrap; }
.tf { list-style: decimal; }
.tfbox { display: inline-block; border: 1px solid #000; padding: 0 5px; margin-right: 6px; font-size: 9.5pt; }
.key { break-before: page; }
.key li { margin: 0 0 6px; }
.why { display: block; font-size: 10.5pt; color: #222; white-space: pre-wrap; }
`;

/** A complete, self-contained page that prints cleanly. Everything typed by the student is escaped. */
export function paperHtml(questions: readonly QuestionInput[], opts: PaperOptions): string {
  const title = opts.title.trim() || "Question paper";
  const items = questions
    .map((q, i) => `<section class="q"><span class="num">${i + 1}.</span> ${body(q)}</section>`)
    .join("\n");
  const key = opts.key
    ? `<section class="key"><h2>Answer key</h2><ol>${questions
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body><h1>${esc(title)}</h1><div class="meta"><span>Name: ____________________</span><span>Date: ____________</span><span>Questions: ${questions.length}</span></div>${items}${key}</body></html>`;
}
