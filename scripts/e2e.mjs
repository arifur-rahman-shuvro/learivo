// Browser end-to-end flows on the real screens. Uses e2e/main.tsx (in-memory data, a built-in
// signed-in student) served by the Vite dev server, so no account or network is needed.
// Flows: add questions, edit one, search, practice a session to the result, archive.
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 4183;
const BASE = `http://localhost:${PORT}/e2e/index.html`;
const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const stop = () => server.kill();
process.on("exit", stop);
for (let i = 0; ; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* not up yet */
  }
  if (i > 80) throw new Error("Dev server did not start");
  await new Promise((r) => setTimeout(r, 300));
}

const problems = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
page.setDefaultTimeout(8000);
page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
let step = "start";
const expectText = async (text, scope = "main") => {
  const ok = await page
    .locator(scope)
    .getByText(text)
    .first()
    .waitFor()
    .then(
      () => true,
      () => false,
    );
  if (!ok) throw new Error(`Expected to see ${text}`);
};

try {
  step = "open Questions";
  await page.goto(`${BASE}#/questions`, { waitUntil: "networkidle" });
  await expectText("Add your first questions");

  step = "add three questions in the editor";
  for (const n of [1, 2, 3]) {
    await page.getByRole("button", { name: "Add question" }).first().click();
    await page.getByRole("button", { name: /Write one question/ }).click();
    await page.locator("#q-stem").fill(`Which is right in case ${n}?`);
    for (const i of [1, 2, 3, 4, 5]) {
      await page.getByLabel(`Option ${i} text`).fill(i === 1 ? "Right" : `Wrong ${i}`);
    }
    await page.getByLabel("Option 1 is correct").check();
    await page.getByRole("button", { name: "Save question" }).click();
    await expectText(`Which is right in case ${n}?`);
  }
  await expectText("3 questions");

  step = "edit a question";
  await page.getByText("Which is right in case 2?").first().click();
  await page.locator("#q-stem").fill("Which is right in the edited case?");
  await page.getByRole("button", { name: "Save question" }).click();
  await expectText("Which is right in the edited case?");
  if (await page.getByText("Which is right in case 2?").count()) {
    throw new Error("The old wording is still shown after the edit");
  }

  step = "practice a session";
  await page.goto(`${BASE}#/practice`);
  await page.getByRole("button", { name: /^Quick 10/ }).click();
  await expectText("Question 1 of 3");
  for (let n = 1; n <= 3; n++) {
    await expectText(`Question ${n} of 3`);
    await page.getByText("Right", { exact: true }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await page.getByRole("button", { name: n === 3 ? /Finish|Submit/ : "Next" }).click();
  }
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.waitForTimeout(800);
  await expectText("Accuracy");
  const result = await page.locator("main").innerText();
  if (!/3 \/ 3\s+Correct/.test(result) || !/Accuracy\s+100%/.test(result)) {
    throw new Error(`Result screen did not show 3 of 3 correct: ${result.slice(0, 200)}`);
  }

  step = "the session shows in Insights";
  await page.goto(`${BASE}#/insights`);
  await page.waitForTimeout(800);
  const insights = await page.locator("main").innerText();
  if (/No practice yet|Nothing yet/i.test(insights))
    throw new Error("Insights ignores the finished session");

  step = "archive and restore a question";
  await page.goto(`${BASE}#/questions`);
  await expectText("3 questions");
  await page.getByRole("button", { name: /^Actions: Which is right in case 3/ }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expectText("2 questions");
  await page.getByRole("tab", { name: "Archive" }).click();
  await expectText("Which is right in case 3?");
  await page.getByRole("button", { name: /^Actions: Which is right in case 3/ }).click();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await page.getByRole("tab", { name: "Questions" }).click();
  await expectText("3 questions");

  step = "import questions from pasted JSON";
  const records = [1, 2, 3, 4].map((n) => ({
    type: "sba",
    stem: `Imported question ${n}`,
    options: [{ text: "Right", correct: true }, { text: "Wrong A" }, { text: "Wrong B" }],
    subject: "Anatomy",
    tags: ["e2e"],
  }));
  await page.getByRole("button", { name: "Add question" }).first().click();
  await page.getByRole("button", { name: /Paste what AI gave you/ }).click();
  await page
    .locator("textarea")
    .first()
    .fill(JSON.stringify({ questions: records }));
  await page.getByRole("button", { name: "Check questions" }).click();
  await expectText("Preview (4 of 4)", "body");
  await page.getByRole("button", { name: "Import 4 questions" }).click();
  await expectText("7 questions");

  step = "build and sit an exam";
  await page.goto(`${BASE}#/practice`);
  await page.getByRole("button", { name: "Create an exam" }).click();
  await page.getByLabel("Title").fill("E2E exam");
  await page.getByLabel("Number of questions for rule 1").fill("4");
  await page.getByRole("button", { name: "Save exam" }).click();
  await expectText("E2E exam");
  await page.getByRole("button", { name: "Start exam" }).click();
  await expectText("Question 1 of 4");
  for (let n = 1; n <= 4; n++) {
    await expectText(`Question ${n} of 4`);
    // Answer the last question wrongly on purpose, so the score is 3 of 4.
    const pick =
      n === 4 ? page.getByText(/^Wrong/).first() : page.getByText("Right", { exact: true });
    await pick.click();
    if (n < 4) await page.getByRole("button", { name: "Next" }).click();
  }
  await page
    .getByRole("button", { name: /Finish|Submit/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expectText("Accuracy");
  const exam = await page.locator("main").innerText();
  if (!/75%\s+Score\s+3 \/ 4/.test(exam) || !/Wrong\s+1\b/.test(exam)) {
    throw new Error(`Exam result was not 3 of 4 with 1 wrong: ${exam.slice(0, 200)}`);
  }
  await page.getByRole("button", { name: "Practice missed questions" }).waitFor();

  step = "offline: download a copy, then edit and add with no connection";
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const off = await ctx2.newPage();
  off.setDefaultTimeout(8000);
  off.on("pageerror", (e) => problems.push(`offline page error: ${e.message}`));
  const OFFLINE = `http://localhost:${PORT}/e2e/offline.html`;
  const seen = async (text, scope = "main") => {
    await off.locator(scope).getByText(text).first().waitFor();
  };
  const dbHolds = (stem) =>
    off.evaluate(async (t) => {
      const r = await window.__bank.list({
        search: "",
        status: "active",
        nodeId: null,
        unclassified: false,
        qtypes: [],
        difficulties: [],
        tagId: null,
        collectionId: null,
        sort: "updated",
        offset: 0,
        limit: 50,
      });
      return r.items.some((q) => q.stem === t);
    }, stem);
  await off.goto(`${OFFLINE}#/questions`, { waitUntil: "networkidle" });
  await off.getByRole("button", { name: "Add question" }).first().click();
  await off.getByRole("button", { name: /Paste what AI gave you/ }).click();
  const recs = [1, 2, 3].map((n) => ({
    type: "sba",
    stem: `Offline source ${n}`,
    options: [{ text: "Right", correct: true }, { text: "Wrong A" }, { text: "Wrong B" }],
    subject: "Anatomy",
  }));
  await off
    .locator("textarea")
    .first()
    .fill(JSON.stringify({ questions: recs }));
  await off.getByRole("button", { name: "Check questions" }).click();
  await off.getByRole("button", { name: "Import 3 questions" }).click();
  await seen("3 questions");
  await off.keyboard.press("Escape");
  await off
    .getByRole("button", { name: /^Saved/ })
    .first()
    .click();
  await off.getByRole("button", { name: "Update copy" }).click();
  await seen("3 questions, updated", "body");
  await off.keyboard.press("Escape");

  step = "offline: edit one question and add one";
  await ctx2.setOffline(true);
  await off.getByText("Offline source 2").first().click();
  await off.locator("#q-stem").fill("Edited while offline");
  await off.getByRole("button", { name: "Save question" }).click();
  await seen("Edited while offline");
  await off.getByRole("button", { name: "Add question" }).first().click();
  await off.getByRole("button", { name: /Write one question/ }).click();
  await off.locator("#q-stem").fill("Added while offline");
  for (const i of [1, 2, 3, 4, 5]) {
    await off.getByLabel(`Option ${i} text`).fill(i === 1 ? "Right" : `Wrong ${i}`);
  }
  await off.getByLabel("Option 1 is correct").check();
  await off.getByRole("button", { name: "Save question" }).click();
  await seen("Added while offline");
  await seen("4 questions");
  await off.getByRole("button", { name: /2 waiting to sync/ }).waitFor();
  if (await dbHolds("Added while offline"))
    throw new Error("Offline changes reached the database while offline");

  step = "offline: changes are sent when the connection returns";
  await ctx2.setOffline(false);
  await off
    .getByRole("button", { name: /^Saved/ })
    .first()
    .waitFor();
  for (let i = 0; i < 40 && !(await dbHolds("Added while offline")); i++)
    await off.waitForTimeout(250);
  if (!(await dbHolds("Added while offline")))
    throw new Error("The added question never reached the database");
  if (!(await dbHolds("Edited while offline")))
    throw new Error("The edit never reached the database");
  if (await dbHolds("Offline source 2"))
    throw new Error("The old wording is still in the database");
  await ctx2.close();
} catch (e) {
  problems.push(`${step}: ${e.message}`);
  try {
    problems.push((await page.locator("main").innerText()).slice(0, 600));
  } catch {
    /* page gone */
  }
} finally {
  await browser.close();
  stop();
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  "End-to-end flows passed: add, edit, practice, results, insights, archive, restore, import, exam, offline edit and sync",
);
