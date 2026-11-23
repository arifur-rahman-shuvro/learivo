// Captures the install-dialog screenshots listed in public/manifest.webmanifest from the real app
// (test harness, in-memory sample data). Run: node scripts/pwa-shots.mjs. Needs Python Pillow.
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const PORT = 4192;
const BASE = `http://localhost:${PORT}/e2e/index.html`;
const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
for (let i = 0; ; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* not up yet */
  }
  if (i > 80) throw new Error("Dev server did not start");
  await new Promise((r) => setTimeout(r, 300));
}
const items = [
  [
    "Anatomy",
    "Which nerve supplies the deltoid muscle?",
    "Axillary nerve",
    "Radial nerve",
    "Musculocutaneous nerve",
  ],
  [
    "Anatomy",
    "Which bone forms the prominence of the elbow?",
    "Olecranon of the ulna",
    "Head of the radius",
    "Medial epicondyle",
  ],
  [
    "Physiology",
    "Which ion mainly sets the resting membrane potential?",
    "Potassium",
    "Sodium",
    "Chloride",
  ],
  ["Physiology", "Which hormone lowers blood glucose?", "Insulin", "Glucagon", "Cortisol"],
  [
    "Biochemistry",
    "Which vitamin deficiency causes scurvy?",
    "Vitamin C",
    "Vitamin D",
    "Vitamin K",
  ],
  [
    "Biochemistry",
    "Which enzyme is deficient in classical phenylketonuria?",
    "Phenylalanine hydroxylase",
    "Tyrosinase",
    "Hexokinase",
  ],
  [
    "Pharmacology",
    "Which drug class is first line for anaphylaxis?",
    "Adrenaline",
    "Antihistamine",
    "Oral steroid",
  ],
  [
    "Pathology",
    "Which cell is the hallmark of Hodgkin lymphoma?",
    "Reed-Sternberg cell",
    "Smudge cell",
    "Auer rod cell",
  ],
].map(([subject, stem, right, a, b]) => ({
  type: "sba",
  stem,
  explanation: "Standard textbook answer.",
  subject,
  tags: ["sample"],
  options: [{ text: right, correct: true }, { text: a }, { text: b }],
}));
mkdirSync("public/pwa", { recursive: true });
const browser = await chromium.launch();
async function session(w, h, scale, shots) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: scale,
  });
  await ctx.addInitScript(() => {
    localStorage.setItem("learivo.theme", "default");
    localStorage.setItem("learivo.mode", "light");
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(`${BASE}#/questions`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add questions", exact: true }).click();
  await page.getByRole("button", { name: /Paste what AI gave you/ }).click();
  await page
    .locator("textarea")
    .first()
    .fill(JSON.stringify({ questions: items }));
  await page.getByRole("button", { name: "Check questions" }).click();
  await page.getByRole("button", { name: "Import 8 questions" }).click();
  await page.getByText("8 questions").first().waitFor();
  await page.goto(`${BASE}#/practice`);
  await page.getByRole("button", { name: /^Quick 10/ }).click();
  for (let n = 1; n <= 8; n++) {
    await page.getByText(`Question ${n} of 8`).first().waitFor();
    if (n === 4 && shots.player) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: shots.player });
    }
    // Questions come in random order: find which one is on screen.
    let shown = items[0];
    for (const it of items) if (await page.getByText(it.stem).first().isVisible()) shown = it;
    const pick =
      n % 3 === 0
        ? page.getByText(shown.options[1].text, { exact: true })
        : page.getByText(shown.options[0].text, { exact: true });
    await pick.click();
    if (n < 8) await page.getByRole("button", { name: "Next" }).click();
  }
  await page
    .getByRole("button", { name: /Finish|Submit/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Submit", exact: true }).last().click();
  await page.getByText("Accuracy").first().waitFor();
  await page.evaluate(() => (location.hash = "#/home"));
  await page.waitForSelector("h1");
  await page.waitForTimeout(900);
  await page.screenshot({ path: shots.home });
  await ctx.close();
}
try {
  await session(360, 640, 3, {
    home: "public/pwa/pwa-home-narrow.png",
    player: "public/pwa/pwa-practice-narrow.png",
  });
  await session(1280, 720, 1.5, { home: "public/pwa/pwa-home-wide.png" });
} finally {
  await browser.close();
  server.kill();
}
for (const f of ["pwa-home-narrow", "pwa-practice-narrow", "pwa-home-wide"]) {
  execFileSync("python3", [
    "-c",
    `from PIL import Image;n="public/pwa/${f}.png";Image.open(n).convert("RGB").quantize(256,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).save(n,optimize=True)`,
  ]);
}
console.log("pwa screenshots written");
