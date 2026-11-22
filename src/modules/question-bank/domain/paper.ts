import { TYPE_LABELS, type QuestionInput, type QuestionType } from "./model.ts";

/** What is printed above the questions when the paper is an exam. */
interface ExamMeta {
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
const SECTION_ORDER: QuestionType[] = [
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

const CHOICE = new Set<QuestionType>(["sba", "single_choice", "multi_select"]);

function body(q: QuestionInput, grouped: boolean, withKey: boolean): string {
  const stem = esc(q.stem);
  if (q.qtype === "fill_blank") {
    return `<p class="stem">${esc(q.stem.replace(BLANK, "__________"))}</p>`;
  }
  const o = "options" in q.answer ? q.answer.options : [];
  if (q.qtype === "true_false") {
    return (
      `<p class="stem">${stem}</p><ol class="opts tf">` +
      o
        .map(
          (x, i) =>
            `<li${withKey ? ` data-ok="${x.correct ? "T" : "F"}"` : ""}><span class="tl">${letter(i).toLowerCase()}</span><span class="ot">${esc(x.text)}</span>` +
            `<span class="tfs"><b class="bub" data-k="T">T</b><b class="bub" data-k="F">F</b></span></li>`,
        )
        .join("") +
      "</ol>"
    );
  }
  // Inside a section the direction is already given, so repeat it only on a plain list.
  const hint =
    q.qtype === "multi_select" && !grouped ? '<p class="hint">Choose all that apply.</p>' : "";
  return (
    `<p class="stem">${stem}</p>${hint}<ol class="opts">` +
    o
      .map(
        (x, i) =>
          `<li data-k="${letter(i)}"><b class="bub">${letter(i)}</b><span class="ot">${esc(x.text)}</span></li>`,
      )
      .join("") +
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
function sectionsOf(questions: readonly QuestionInput[]) {
  return SECTION_ORDER.map((type) => ({
    type,
    questions: questions.filter((q) => q.qtype === type),
  })).filter((s) => s.questions.length > 0);
}

const STYLE = `
:root { --ink: #16243f; --gold: #b7791f; --tint: #eef1f7; --rule: #c4cbdb; --soft: #5b667d; }
@page { size: A4; margin: 18mm 14mm 20mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9pt system-ui, sans-serif; color: #5b667d; } @bottom-left { content: var(--foot); font: 9pt system-ui, sans-serif; color: #5b667d; } }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Georgia, "Times New Roman", "Noto Serif Bengali", "Noto Sans Bengali", "Nirmala UI", Kalpurush, serif; color: #111827; background: #fff; font-size: 12pt; line-height: 1.45; margin: 0; padding: 0 14px 24px; }
.sans, .bar, .chips, .box, .sec, .bub, .cell, .num, .grade { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", "Nirmala UI", Kalpurush, sans-serif; }
.bar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; background: #fff; border-bottom: 1px solid var(--rule); padding: 8px 0; margin: 0 0 10px; font-size: 13px; }
.bar a, .bar button { font: inherit; color: var(--ink); background: var(--tint); border: 1px solid var(--rule); border-radius: 999px; padding: 4px 12px; text-decoration: none; cursor: pointer; min-height: 32px; }
.bar button.go { background: var(--ink); color: #fff; border-color: var(--ink); }
.bar .prog { margin-left: auto; color: var(--soft); }
.cover { background: var(--ink); color: #fff; padding: 18px 22px 16px; border-radius: 6px; border-bottom: 5px solid var(--gold); break-inside: avoid; }
.cover h1 { font-size: 23pt; line-height: 1.15; margin: 0; letter-spacing: .01em; }
.cover .kind { margin: 0 0 6px; font: 600 9.5pt system-ui, sans-serif; color: #e9c46a; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; font-size: 10.5pt; }
.chips li { border: 1px solid rgba(255,255,255,.55); border-radius: 999px; padding: 3px 12px; }
.chips b { color: #e9c46a; }
.info { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin: 12px 0; break-inside: avoid; }
.box { border: 1.5px solid var(--ink); border-radius: 5px; padding: 4px 9px 18px; font-size: 8.5pt; color: var(--soft); min-height: 44px; }
.box.score { border-style: dashed; }
.instr { border-left: 5px solid var(--gold); background: var(--tint); padding: 8px 14px; margin: 0 0 14px; font-size: 12pt; white-space: pre-wrap; break-inside: avoid; }
.instr h2 { font: 700 10.5pt system-ui, sans-serif; margin: 0 0 3px; }
.scheme { width: 100%; border-collapse: collapse; margin: 0 0 14px; font: 10pt system-ui, sans-serif; break-inside: avoid; }
.scheme td { border: 1px solid var(--rule); padding: 5px 10px; }
.scheme td:first-child { background: var(--tint); font-weight: 600; width: 34%; }
.sec { display: flex; align-items: center; gap: 12px; margin: 20px 0 10px; padding: 7px 12px; background: var(--tint); border-left: 6px solid var(--ink); border-radius: 0 5px 5px 0; break-after: avoid; break-inside: avoid; }
.sec .ltr { flex: none; width: 30px; height: 30px; border-radius: 50%; background: var(--ink); color: #fff; font-weight: 700; display: grid; place-items: center; }
.sec h3 { margin: 0; font: 700 13pt system-ui, sans-serif; }
.sec p { margin: 0; font: 10.5pt system-ui, sans-serif; color: var(--soft); }
.sec .pts { margin-left: auto; text-align: right; font: 700 10pt system-ui, sans-serif; white-space: nowrap; }
.cols { column-count: 2; column-gap: 12mm; column-rule: 1.5px solid var(--rule); }
.q { display: flex; gap: 9px; break-inside: avoid; margin: 0 0 4px; padding: 7px 0 9px; border-bottom: 1px dotted var(--rule); }
.q .num { flex: none; min-width: 28px; height: 28px; padding: 0 5px; border-radius: 6px; background: var(--ink); color: #fff; font-weight: 700; font-size: 11pt; display: grid; place-items: center; }
.qb { flex: 1; min-width: 0; }
.stem { margin: 2px 0 6px; white-space: pre-wrap; }
.hint { margin: 0 0 6px; font: italic 11pt Georgia, serif; color: var(--soft); }
.opts { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.opts li { display: flex; gap: 9px; align-items: flex-start; padding: 2px 4px; border-radius: 5px; }
.opts .ot { white-space: pre-wrap; padding-top: 1px; flex: 1; }
.bub { flex: none; width: 24px; height: 24px; border: 1.5px solid var(--ink); border-radius: 50%; display: grid; place-items: center; font-size: 10.5pt; font-weight: 600; color: var(--ink); background: #fff; }
.opts .tl { flex: none; width: 16px; font: 600 11pt system-ui, sans-serif; color: var(--soft); }
.tfs { display: flex; gap: 6px; }
.on .bub, li.on > .bub, .bub.on { background: var(--ink); color: #fff; }
.wait li, .wait .bub { cursor: pointer; }
.q.good { border-color: #2f855a; box-shadow: inset 5px 0 0 #2f855a; }
.q.bad { border-color: #c53030; box-shadow: inset 5px 0 0 #c53030; }
li.right > .bub, .bub.right { background: #2f855a !important; border-color: #2f855a; color: #fff !important; }
li.wrong > .bub, .bub.wrong { background: #c53030 !important; border-color: #c53030; color: #fff !important; }
.work { margin: 18px 0 0; min-height: 52mm; border: 1.5px dashed var(--rule); border-radius: 6px; padding: 6px 12px; font: 9pt system-ui, sans-serif; color: var(--soft); break-inside: avoid; background-image: radial-gradient(#c4cbdb 1px, transparent 1.2px); background-size: 7mm 7mm; }
.keypage { break-before: page; }
.keypage .cover { padding: 14px 22px; }
.keypage .cover h1 { font-size: 19pt; }
.keypage h3 { margin: 18px 0 8px; font: 700 11.5pt system-ui, sans-serif; color: var(--ink); border-bottom: 2px solid var(--gold); padding-bottom: 3px; break-after: avoid; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(34mm, 1fr)); gap: 6px; }
.cell { display: flex; align-items: center; gap: 8px; border: 1px solid var(--rule); border-radius: 5px; padding: 4px 8px; break-inside: avoid; font-size: 12pt; }
.cell.wide { grid-column: span 2; }
.cell b { flex: none; min-width: 24px; height: 24px; display: grid; place-items: center; border-radius: 5px; background: var(--ink); color: #fff; font-size: 9.5pt; }
.cell span { font-weight: 700; }
.whypage { break-before: page; }
.whypage li { margin: 0 0 8px; break-inside: avoid; }
.whypage .ans { font: 700 10pt system-ui, sans-serif; color: var(--ink); }
.why { display: block; white-space: pre-wrap; font-size: 12pt; color: #374151; }
@media screen { body { max-width: 820px; margin: 0 auto; background: #f3f4f8; padding: 0 14px 40px; } .page { background: #fff; padding: 4px 4px 8px; } .keypage, .whypage { margin-top: 28px; padding-top: 14px; border-top: 3px dashed var(--rule); } .q.live:hover { border-color: var(--ink); } }
@media print { .bar, .noprint { display: none !important; } body { background: #fff; padding: 0; max-width: none; } }
@media screen and (max-width: 640px) { .cols { column-count: 1; column-rule: 0; } }
@media (max-width: 520px) { .info { grid-template-columns: 1fr; } .cover h1 { font-size: 18pt; } .sec { flex-wrap: wrap; } }
`;

const SCRIPT = `
(function () {
  var d = document, qs = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var body = d.body, checking = false, ready = body.getAttribute("data-check") === "1";
  var qsAll = qs(".q.live");
  function clear() { qs(".on,.right,.wrong,.good,.bad").forEach(function (e) { e.classList.remove("on", "right", "wrong", "good", "bad"); }); checking = false; body.classList.add("wait"); }
  function progress() {
    var done = qsAll.filter(function (q) { return q.querySelector(".on"); }).length;
    var p = d.getElementById("prog"); if (p) p.textContent = done + " of " + qsAll.length + " answered";
  }
  body.classList.add("wait");
  qsAll.forEach(function (q) {
    var multi = q.getAttribute("data-multi") === "1";
    qs(".opts li", q).forEach(function (li) {
      if (q.getAttribute("data-tf") === "1") {
        qs(".bub", li).forEach(function (b) { b.addEventListener("click", function () {
          if (checking) return; var on = b.classList.contains("on");
          qs(".bub", li).forEach(function (x) { x.classList.remove("on"); }); if (!on) b.classList.add("on"); progress(); }); });
      } else li.addEventListener("click", function () {
        if (checking) return; var on = li.classList.contains("on");
        if (!multi) qs(".opts li", q).forEach(function (x) { x.classList.remove("on"); });
        li.classList.toggle("on", !on); progress(); });
    });
  });
  var chk = d.getElementById("check"), rst = d.getElementById("reset");
  if (rst) rst.addEventListener("click", function () { clear(); progress(); });
  if (chk && ready) chk.addEventListener("click", function () {
    qs(".right,.wrong,.good,.bad").forEach(function (e) { e.classList.remove("right", "wrong", "good", "bad"); }); checking = true; var good = 0;
    qsAll.forEach(function (q) {
      var ok = true;
      if (q.getAttribute("data-tf") === "1") {
        qs(".opts li", q).forEach(function (li) {
          var want = li.getAttribute("data-ok"), pick = qs(".bub.on", li)[0];
          if (!pick || pick.getAttribute("data-k") !== want) ok = false;
          qs(".bub", li).forEach(function (b) { if (b.getAttribute("data-k") === want) b.classList.add("right"); else if (b.classList.contains("on")) b.classList.add("wrong"); });
        });
      } else {
        var want = (q.getAttribute("data-ok") || "").split(",");
        qs(".opts li", q).forEach(function (li) {
          var k = li.getAttribute("data-k"), isRight = want.indexOf(k) >= 0, picked = false;
          picked = li.classList.contains("on");
          if (isRight !== picked) ok = false;
          li.classList.remove("on");
          if (isRight) li.classList.add("right"); else if (picked) li.classList.add("wrong");
        });
      }
      q.classList.add(ok ? "good" : "bad"); if (ok) good++;
    });
    var p = d.getElementById("prog"); if (p) p.textContent = good + " of " + qsAll.length + " correct";
  });
  progress();
})();
`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const marks = (n: number) => String(Math.round(n * 100) / 100);

/** Text for a CSS string (the page footer), so it can never end the style block or the string. */
const cssText = (s: string) =>
  s
    .replace(/[\\"]/g, "\\$&")
    .replace(/</g, "\\3c ")
    .replace(/[\r\n]+/g, " ");

function chips(count: number, m: ExamMeta): string {
  return (
    `<ul class="chips"><li><b>${count}</b> ${count === 1 ? "question" : "questions"}</li>` +
    `<li>Total marks: <b>${marks(count * m.marksCorrect)}</b></li>` +
    `<li>${m.minutes ? `Time: <b>${m.minutes} minutes</b>` : "<b>No time limit</b>"}</li></ul>`
  );
}

function schemeTable(m: ExamMeta): string {
  const wrong =
    m.marksWrong > 0
      ? `${marks(m.marksWrong)} deducted for each wrong answer`
      : "No marks are lost for a wrong answer";
  return (
    `<table class="scheme"><tr><td>Each correct answer</td><td>${marks(m.marksCorrect)} ${m.marksCorrect === 1 ? "mark" : "marks"}</td></tr>` +
    `<tr><td>Wrong answers</td><td>${wrong}.</td></tr></table>`
  );
}

/** A complete, self-contained page that prints cleanly. Everything typed by the student is escaped. */
export function paperHtml(questions: readonly QuestionInput[], opts: PaperOptions): string {
  const title = opts.title.trim() || "Question paper";
  const secs = opts.exam ? sectionsOf(questions) : [{ type: null, questions: [...questions] }];
  const ordered = secs.flatMap((s) => s.questions);
  let n = 0;
  const item = (q: QuestionInput, grouped: boolean) => {
    const i = ++n;
    const live = CHOICE.has(q.qtype) || q.qtype === "true_false";
    const ok =
      "options" in q.answer
        ? q.answer.options.flatMap((o, k) => (o.correct ? [letter(k)] : []))
        : [];
    const attrs = live
      ? ` live" id="q${i}"${q.qtype === "multi_select" ? ' data-multi="1"' : ""}${q.qtype === "true_false" ? ' data-tf="1"' : opts.key ? ` data-ok="${ok.join(",")}"` : ""}`
      : `" id="q${i}"`;
    return `<section class="q${attrs}><span class="num">${i}</span><div class="qb">${body(q, grouped, opts.key)}</div></section>`;
  };

  const marksEach = opts.exam ? marks(opts.exam.marksCorrect) : "";
  const items = secs
    .map((s, i) => {
      const qs = `<div class="cols">${s.questions.map((q) => item(q, s.type !== null)).join("\n")}</div>`;
      if (s.type === null) return qs;
      return (
        `<div class="sec" id="s${i}"><span class="ltr">${letter(i)}</span><div><h3>Section ${letter(i)}: ${esc(TYPE_LABELS[s.type])}</h3>` +
        `<p>${esc(DIRECTIONS[s.type])}</p></div><span class="pts">${plural(s.questions.length, "question")}<br>${marksEach} each</span></div>\n` +
        qs
      );
    })
    .join("\n");

  const nav =
    secs.length > 1 && opts.exam
      ? secs.map((_s, i) => `<a href="#s${i}">Section ${letter(i)}</a>`).join("")
      : "";
  const bar =
    `<nav class="bar noprint" aria-label="Paper tools">${nav}` +
    `${opts.key ? '<button type="button" class="go" id="check">Check my answers</button>' : ""}` +
    `<button type="button" id="reset">Clear</button><span class="prog" id="prog" aria-live="polite"></span></nav>`;

  const info =
    '<div class="info"><div class="box">Name</div><div class="box">Roll / ID</div>' +
    `<div class="box">Date</div></div>`;
  const kind = opts.exam ? "Exam paper" : "Question paper";
  const exam = opts.exam;
  const cover =
    `<header class="cover"><p class="kind">${kind}</p><h1>${esc(title)}</h1>` +
    (exam
      ? chips(questions.length, exam)
      : `<ul class="chips"><li><b>${questions.length}</b> ${questions.length === 1 ? "question" : "questions"}</li></ul>`) +
    "</header>";
  const instr =
    exam && exam.instructions.trim()
      ? `<div class="instr"><h2>Instructions</h2>${esc(exam.instructions)}</div>`
      : "";
  const work = exam ? '<div class="work">Rough work</div>' : "";

  const cell = (q: QuestionInput, i: number) =>
    `<div class="cell${q.qtype === "true_false" || q.qtype === "fill_blank" ? " wide" : ""}"><b>${i}</b><span>${esc(answerText(q))}</span></div>`;
  let k = 0;
  const keyBody = secs
    .map((s, i) => {
      const cells = s.questions.map((q) => cell(q, ++k)).join("");
      return (
        (s.type === null ? "" : `<h3>Section ${letter(i)}: ${esc(TYPE_LABELS[s.type])}</h3>`) +
        `<div class="grid">${cells}</div>`
      );
    })
    .join("");
  const key = opts.key
    ? `<main class="keypage"><header class="cover"><p class="kind">For the teacher</p><h1>Answer key</h1><ul class="chips"><li>${esc(title)}</li></ul></header>${keyBody}</main>`
    : "";
  let w = 0;
  const why =
    opts.key && opts.explanations
      ? ordered
          .map((q) => {
            const i = ++w;
            return q.explanation.trim()
              ? `<li value="${i}"><span class="ans">Q${i}: ${esc(answerText(q))}</span><span class="why">${esc(q.explanation)}</span></li>`
              : "";
          })
          .join("")
      : "";
  const whyPage = why
    ? `<main class="whypage"><header class="cover"><p class="kind">For the teacher</p><h1>Explanations</h1><ul class="chips"><li>${esc(title)}</li></ul></header><ol style="list-style:none;padding:0;margin-top:14px">${why}</ol></main>`
    : "";

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>` +
    `<style>:root{--foot:"${cssText(title)}"}${STYLE}</style></head>` +
    `<body data-check="${opts.key ? 1 : 0}">${bar}<main class="page">${cover}${info}${instr}${exam ? schemeTable(exam) : ""}${items}${work}</main>${key}${whyPage}<script>${SCRIPT}</script></body></html>`
  );
}
