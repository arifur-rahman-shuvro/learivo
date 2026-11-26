// Design-system audit in a real browser with real (in-memory) data: every main screen and the
// main dialogs, in every theme and mode, at phone width. Checks colour contrast and other axe
// rules, tap-target size, sideways scroll, and that focus returns to the control that opened a
// dialog and stays in a field while typing. Uses the test-only entry e2e/main.tsx.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const axeSource = readFileSync(
  createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
  "utf8",
);
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

const combos = [
  ["default", "light"],
  ["default", "dark"],
  ["forest", "light"],
  ["forest", "dark"],
  ["space", "dark"],
  ["amoled", "dark"],
];
const problems = [];
const browser = await chromium.launch();

async function check(page, label) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // let opening animations settle
  if ((await page.evaluate(() => typeof window.axe)) === "undefined") {
    await page.addScriptTag({ content: axeSource });
  }
  const found = await page.evaluate(async () => {
    const r = await window.axe.run(document.body, { rules: { region: { enabled: false } } });
    return r.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
    );
  });
  for (const f of found) problems.push(`${label}: ${f}`);
  const small = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "button, a[href], input, select, textarea, [role=tab], [role=menuitem]",
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const type = el.getAttribute("type");
        const inLabel = el.closest("label") !== null; // the whole label is the tap target
        const hidden =
          r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden";
        const sr = el.closest(".sr-only") !== null;
        return !hidden && !sr && type !== "hidden" && !inLabel && (r.height < 40 || r.width < 40);
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`,
      ),
  );
  for (const s of small) problems.push(`${label}: tap target under 40px: ${s}`);
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (over > 0) problems.push(`${label}: page is ${over}px wider than the screen`);
}

const close = async (page) => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
};

try {
  for (const [theme, mode] of combos) {
    const tag = `${theme}/${mode}`;
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
    await ctx.addInitScript(
      ([t, m]) => {
        localStorage.setItem("learivo.theme", t);
        localStorage.setItem("learivo.mode", m);
      },
      [theme, mode],
    );
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    page.on("pageerror", (e) => problems.push(`${tag}: page error: ${e.message}`));
    let step = "start";
    try {
      // Seed: import questions in two subjects, then finish a practice session.
      step = "seed";
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
      await check(page, `${tag} results`);

      // Main screens with data.
      for (const route of [
        "home",
        "questions",
        "practice",
        "study",
        "games",
        "review",
        "review/flashcards",
        "review/notes",
        "review/glossary",
        "insights",
      ]) {
        step = route;
        await page.evaluate((r) => (location.hash = `#/${r}`), route);
        await page.waitForSelector("h1");
        await check(page, `${tag} ${route}`);
      }

      // Insights tabs.
      step = "insights tabs";
      await page.evaluate(() => (location.hash = "#/insights"));
      for (const name of ["Subjects", "Mistakes", "Time"]) {
        const tab = page.getByRole("tab", { name });
        if (await tab.count()) {
          await tab.click();
          await check(page, `${tag} insights ${name}`);
        }
      }

      // Dialogs: each must pass the checks open, and give focus back to its opener on close.
      const dialogs = [
        [
          "Add questions hub",
          "#/questions",
          (p) => p.getByRole("button", { name: "Add question" }).first(),
        ],
        ["Export", "#/questions", (p) => p.getByRole("button", { name: "Export" })],
        ["Organize", "#/questions", (p) => p.getByRole("button", { name: "Organize" })],
        ["New exam", "#/practice", (p) => p.getByRole("button", { name: "New exam" })],
      ];
      for (const [name, route, opener] of dialogs) {
        step = `dialog ${name}`;
        await page.evaluate((r) => (location.hash = r), route);
        await page.waitForSelector("h1");
        const trigger = opener(page);
        await trigger.click();
        await page.waitForTimeout(300);
        await check(page, `${tag} dialog ${name}`);
        await close(page);
        const back = await trigger.evaluate((el) => el === document.activeElement);
        if (!back)
          problems.push(`${tag}: focus did not return to the button that opened "${name}"`);
      }

      // Focus stays in a field while typing in a dialog (the dialog must not grab it back).
      step = "typing in a dialog";
      await page.evaluate(() => (location.hash = "#/questions"));
      await page.getByRole("button", { name: "Add question" }).first().click();
      await page.getByRole("button", { name: /Write one question/ }).click();
      await page.locator("#q-stem").click();
      await page.keyboard.type("Typing keeps focus here");
      const kept = await page.evaluate(() => document.activeElement?.id === "q-stem");
      const typed = await page.locator("#q-stem").inputValue();
      if (!kept || typed !== "Typing keeps focus here") {
        problems.push(`${tag}: typing in the editor lost focus or text ("${typed}")`);
      }
      await close(page);
    } catch (e) {
      problems.push(`${tag} (${step}): ${String(e.message).split("\n")[0]}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  stop();
}

const unique = [...new Set(problems)];
if (unique.length) {
  console.error(unique.join("\n"));
  process.exit(1);
}
console.log(
  `Design audit passed: screens, tabs and dialogs with data, ${combos.length} theme/mode combinations at 360 px`,
);
