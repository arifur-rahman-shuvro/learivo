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
console.log("End-to-end flows passed: add, edit, practice, results, insights, archive, restore");
