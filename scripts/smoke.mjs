// Opens the built app at phone width and checks the first screen: it renders, nothing runs off
// the side of the screen, and the page logs no errors. Run after `pnpm build`.
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 4179;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
});
const stop = () => server.kill();
process.on("exit", stop);

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Preview server did not start");
}

const problems = [];
try {
  await waitForServer();
  const browser = await chromium.launch();
  for (const width of [360, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    page.on("pageerror", (e) => problems.push(`${width}px: page error: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`${width}px: console error: ${m.text()}`);
    });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    const heading = await page.locator("h1, h2").first().textContent({ timeout: 5000 });
    if (!heading?.trim()) problems.push(`${width}px: no heading on the first screen`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) problems.push(`${width}px: page is ${overflow}px wider than the screen`);
    await page.close();
  }
  await browser.close();
} finally {
  stop();
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Smoke test passed at 360, 390 and 430 px");
