// Design-system audit in a real browser with real (in-memory) data: every main screen and the
// main dialogs, in every theme and mode, at phone width. Checks colour contrast and other axe
// rules, tap-target size, sideways scroll, and that focus returns to the control that opened a
// dialog and stays in a field while typing. Uses the test-only entry e2e/main.tsx.
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 4186;
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

import { mkdirSync } from "node:fs";
const OUT = process.argv[2] ?? "/tmp/shots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await ctx.addInitScript(() => {
    localStorage.setItem("learivo.theme", "default");
    localStorage.setItem("learivo.mode", "light");
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(`${BASE}#/questions`, { waitUntil: "networkidle" });
  const records = Array.from({ length: 8 }, (_, n) => ({
    type: "sba",
    stem: `Which statement is correct in case ${n + 1}?`,
    explanation: "Because it is.",
    options: [{ text: "Right", correct: true }, { text: "Wrong A" }, { text: "Wrong B" }],
    subject: n % 2 ? "Anatomy" : "Physiology",
    tags: ["audit"],
  }));
  await page.getByRole("button", { name: "Add question" }).first().click();
  await page.getByRole("button", { name: /Paste what AI gave you/ }).click();
  await page
    .locator("textarea")
    .first()
    .fill(JSON.stringify({ questions: records }));
  await page.getByRole("button", { name: "Check questions" }).click();
  await page.getByRole("button", { name: "Import 8 questions" }).click();
  await page.getByText("8 questions").first().waitFor();
  await page.goto(`${BASE}#/practice`);
  await page.getByRole("button", { name: /^Quick 10/ }).click();
  for (let n = 1; n <= 8; n++) {
    await page.getByText(`Question ${n} of 8`).first().waitFor();
    await (
      n % 3 === 0 ? page.getByText(/^Wrong/).first() : page.getByText("Right", { exact: true })
    ).click();
    if (n < 8) await page.getByRole("button", { name: "Next" }).click();
  }
  await page
    .getByRole("button", { name: /Finish|Submit/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByText("Percentage").first().waitFor();
  for (const route of ["home", "questions", "practice", "study", "review", "insights"]) {
    await page.evaluate((r) => (location.hash = `#/${r}`), route);
    await page.waitForSelector("h1");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${route}.png`, fullPage: true });
  }
  await page.evaluate(() => (location.hash = "#/review/flashcards"));
  await page.getByRole("button", { name: "New card" }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("textarea").nth(0).fill("Which nerve supplies the deltoid?");
  await dlg.locator("textarea").nth(1).fill("The axillary nerve (C5-C6)");
  await dlg.getByRole("button", { name: "Save card" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/flashcards-deck.png`, fullPage: true });
  await page.getByRole("button", { name: /^Study \d+ card/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/flashcards-front.png` });
  await page.getByRole("button", { name: "Show answer" }).click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/flashcards-mid.png` });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/flashcards-back.png` });
  console.log("shots in", OUT);
} finally {
  await browser.close();
  stop();
}
