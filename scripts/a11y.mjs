// Opens the built app in a real browser at phone width, in every theme and mode, and runs the
// accessibility checks including colour contrast (which jsdom cannot do), plus a tap-target
// size check. Only the sign-in screen is reachable without an account. Run after `pnpm build`.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const axeSource = readFileSync(
  createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
  "utf8",
);
const PORT = 4180;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
});
const stop = () => server.kill();
process.on("exit", stop);

for (let i = 0; ; i++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
  } catch {
    /* not up yet */
  }
  if (i > 50) throw new Error("Preview server did not start");
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
const user = {
  id: "11111111-1111-1111-1111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const session = {
  access_token: "a.b.c",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "r",
  user,
};
const problems = [];
const browser = await chromium.launch();
try {
  for (const [theme, mode] of combos) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
    await ctx.addInitScript(
      ([t, m]) => {
        localStorage.setItem("learivo.theme", t);
        localStorage.setItem("learivo.mode", m);
      },
      [theme, mode],
    );
    // The project settings answer says Google sign-in is on, so its button is on screen and checked too.
    await ctx.route("**/auth/v1/settings", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ external: { google: true, email: true } }),
      }),
    );
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    // A new visitor meets the introduction first. Its question is answered, so the open answer is checked too.
    await page
      .getByRole("heading", { level: 1, name: "Practise the way the exam asks." })
      .waitFor();
    await checkScreen(page, `${theme}/${mode} landing`);
    await page.getByRole("radio", { name: /Left anterior descending/ }).click();
    await page.getByRole("button", { name: "Sure", exact: true }).click();
    await page.getByText(/Not quite: the answer is the right coronary artery/).waitFor();
    await page.waitForTimeout(400);
    await checkScreen(page, `${theme}/${mode} landing, answered`);
    // The tour's four screens, each opened and checked.
    for (const name of [/Build a test/, /Sit an exam/, /Find weak areas/, /Revise/]) {
      await page.getByRole("tab", { name }).click();
      await page.waitForTimeout(350);
      await checkScreen(page, `${theme}/${mode} landing tour, ${name.source}`);
    }
    await page.getByRole("button", { name: "Show answer" }).click();
    await page.getByRole("button", { name: "Good" }).click();
    await checkScreen(page, `${theme}/${mode} landing tour, card rated`);
    await page.getByRole("button", { name: "Sign in" }).first().click();
    await page.getByRole("button", { name: "Continue with Google" }).waitFor();
    await checkScreen(page, `${theme}/${mode} sign-in`);
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByRole("heading", { name: "Reset your password" }).waitFor();
    await checkScreen(page, `${theme}/${mode} forgot password`);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("heading", { name: "Sign in to Learivo" }).waitFor();
    // Signed-in screens: the account service is answered by a stand-in (empty account), so the
    // screens render their empty state. Nothing leaves the test browser.
    await ctx.route("**/auth/v1/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(r.request().url().includes("/user") ? user : session),
      }),
    );
    await ctx.route("**/rest/v1/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/0" },
        body: "[]",
      }),
    );
    await page.getByLabel(/email/i).fill("e2e@example.test");
    await page
      .getByLabel(/password/i)
      .first()
      .fill("Password123!");
    await page
      .getByRole("button", { name: /^sign in$/i })
      .first()
      .click();
    await page.getByRole("navigation", { name: "Primary" }).waitFor();
    for (const route of ["home", "questions", "practice", "study", "review", "insights"]) {
      await page.evaluate((r) => (location.hash = `#/${r}`), route);
      await page.waitForSelector("h1");
      await page.waitForTimeout(600);
      await checkScreen(page, `${theme}/${mode} ${route}`);
    }
    // Study: a running timer, the stats and history views, and the settings dialog.
    await page.evaluate(() => (location.hash = "#/study"));
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("timer").waitFor();
    await page.waitForTimeout(900); // let tab and dialog animations finish
    await checkScreen(page, `${theme}/${mode} study timer running`);
    await page.getByRole("radio", { name: "Stats" }).click();
    await page.waitForTimeout(900); // let tab and dialog animations finish
    await checkScreen(page, `${theme}/${mode} study stats`);
    await page.getByRole("radio", { name: "History" }).click();
    await page.waitForTimeout(900); // let tab and dialog animations finish
    await checkScreen(page, `${theme}/${mode} study history`);
    await page.getByRole("radio", { name: "Timer" }).click();
    await page.getByRole("button", { name: "Timer settings" }).click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(900); // let tab and dialog animations finish
    await checkScreen(page, `${theme}/${mode} study settings`);
    await ctx.close();
  }
} finally {
  await browser.close();
  stop();
}

async function checkScreen(page, label) {
  {
    await page.evaluate(() => document.fonts.ready);
    if ((await page.evaluate(() => typeof window.axe)) === "undefined")
      await page.addScriptTag({ content: axeSource });
    const found = await page.evaluate(async () => {
      const r = await window.axe.run(document.body, { rules: { region: { enabled: false } } });
      return r.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
      );
    });
    for (const f of found) problems.push(`${label}: ${f}`);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href], input, select, textarea")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const type = el.getAttribute("type");
          const inLabel = el.closest("label") !== null; // the whole label is the tap target
          return r.width > 0 && type !== "hidden" && !inLabel && (r.height < 40 || r.width < 40);
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
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  `Accessibility passed: landing, sign-in and 6 signed-in screens in ${combos.length} theme/mode combinations at 360 px`,
);
