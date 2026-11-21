// Renders a real paper in Chromium: checks the interactive parts and prints a PDF to confirm the answer key starts on its own page.
import { chromium } from "playwright";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { blankQuestion } from "../src/modules/question-bank/domain/model.ts";
import { paperHtml } from "../src/modules/question-bank/domain/paper.ts";

const o = (r) => ({ options: r.map(([text, correct]) => ({ text, correct })) });
const qs = [];
for (let i = 1; i <= 12; i++)
  qs.push({
    ...blankQuestion("sba"),
    stem: `Question ${i}: which organ pumps blood around the whole body?`,
    answer: o([
      ["Liver", false],
      ["Heart", true],
      ["Lung", false],
    ]),
    explanation: "The heart pumps blood.",
  });
qs.push({
  ...blankQuestion("true_false"),
  stem: "Facts:",
  answer: o([
    ["Sky is blue", true],
    ["Fire is cold", false],
  ]),
});
const exam = { instructions: "Answer all.", minutes: 30, marksCorrect: 1, marksWrong: 0 };

const dir = mkdtempSync(join(tmpdir(), "paper-"));
const file = join(dir, "paper.html");
writeFileSync(file, paperHtml(qs, { title: "Check paper", key: true, explanations: true, exam }));
const fails = [];
const ok = (c, m) => {
  if (!c) fails.push(m);
};

const b = await chromium.launch();
const p = await b.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto("file://" + file);
ok((await p.textContent("#prog")) === "0 of 13 answered", "progress starts at 0");
await p.click("#q1 li[data-k=B]");
await p.click("#q2 li[data-k=A]");
await p.click("#q13 li:nth-child(1) .bub[data-k=T]");
await p.click("#q13 li:nth-child(2) .bub[data-k=F]");
ok((await p.textContent("#prog")) === "3 of 13 answered", "progress counts taps");
await p.click("#check");
ok(
  (await p.textContent("#prog")) === "2 of 13 correct",
  "check counts the right ones (q1 and q13)",
);
ok(await p.locator("#q1.good").count(), "right answer marked");
ok(await p.locator("#q2.bad").count(), "wrong answer marked");
await p.click("#reset");
ok((await p.textContent("#prog")) === "0 of 13 answered", "clear resets");
ok(errors.length === 0, "no script errors: " + errors.join(";"));

const pdf = join(dir, "paper.pdf");
await p.emulateMedia({ media: "print" });
const lefts = await p.$$eval(
  "#q1, #q2, #q3, #q4, #q5, #q6, #q7, #q8, #q9, #q10, #q11, #q12",
  (els) => els.map((e) => Math.round(e.getBoundingClientRect().left)),
);
ok(
  new Set(lefts).size === 2,
  "questions sit in two columns, saw lefts " + [...new Set(lefts)].join(","),
);
ok(
  await p.$eval(".cols", (e) => getComputedStyle(e).columnRuleStyle === "solid"),
  "a divider line sits between the columns",
);
ok(await p.$eval(".stem", (e) => getComputedStyle(e).fontSize === "16px"), "question text is 12pt");
await p.pdf({ path: pdf, format: "A4", preferCSSPageSize: true, printBackground: true });
await b.close();

const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [pdf]).toString())[1]);
let keyPage = 0,
  whyPage = 0,
  lastQ = 0;
for (let i = 1; i <= pages; i++) {
  const t = execFileSync("pdftotext", ["-f", String(i), "-l", String(i), pdf, "-"]).toString();
  if (/Answer key/.test(t)) keyPage = i;
  if (/Explanations/.test(t)) whyPage = i;
  if (/Question 12:/.test(t) || /Sky is blue/.test(t)) lastQ = i;
  if (keyPage === i) ok(!/Question \d+:/.test(t), "answer key page has no questions");
}
ok(keyPage > lastQ && lastQ > 0, `key page ${keyPage} comes after the last question page ${lastQ}`);
ok(whyPage > keyPage, "explanations come after the key");
console.log(
  `paper: ${pages} pages, questions end on ${lastQ}, key on ${keyPage}, explanations on ${whyPage}`,
);
if (fails.length) {
  console.error("paper check FAILED:\n- " + fails.join("\n- "));
  process.exit(1);
}
console.log("paper check passed");
