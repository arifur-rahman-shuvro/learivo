// Builds the brand images from code, so they never drift from the app: the social preview
// (public/social/og-default.png). Run: node scripts/brand.mjs. Needs Python Pillow to shrink the PNG.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const font = readFileSync("src/ui-kit/themes/fonts/inter-latin-wght-normal.woff2").toString(
  "base64",
);
const mark = `<svg width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#0E7490"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/><g fill="#fff"><path d="M17 10h10v30l-5-5-5 5z"/><path d="M17 44h30a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4z"/><circle cx="47" cy="22" r="6"/></g></svg>`;
const rows = ["Option A", "Option B", "Option C", "Option D"]
  .map(
    (_, i) =>
      `<div class="row${i === 1 ? " on" : ""}"><i></i><b style="width:${[150, 190, 130, 170][i]}px"></b></div>`,
  )
  .join("");
const page = (w, h, lockup) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font}) format("woff2-variations");font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:${w}px;height:${h}px;font-family:Inter,sans-serif;color:#12142B;background:#F8F9FC;position:relative;overflow:hidden}
.glow{position:absolute;inset:0;background:radial-gradient(520px 360px at 8% 0%,rgba(79,70,229,.14),transparent 70%),radial-gradient(520px 360px at 96% 0%,rgba(14,116,144,.10),transparent 70%)}
.left{position:absolute;left:80px;top:0;bottom:0;width:640px;display:flex;flex-direction:column;justify-content:center;gap:28px}
.brand{display:flex;align-items:center;gap:16px;font-weight:800;font-size:34px;letter-spacing:-.02em}
h1{font-size:${lockup ? 0 : 68}px;line-height:1.04;letter-spacing:-.03em;font-weight:800;max-width:600px}
p{font-size:26px;line-height:1.35;color:#4B5173;max-width:560px}
.card{position:absolute;right:80px;top:${(h - 330) / 2}px;width:440px;height:330px;background:#fff;border:1px solid #D5D9EA;border-radius:20px;box-shadow:0 4px 14px rgba(18,20,43,.06);padding:30px;display:flex;flex-direction:column;gap:16px}
.q{height:14px;border-radius:7px;background:#D5D9EA}.q.s{width:70%}
.row{display:flex;align-items:center;gap:14px;border:1.5px solid #D5D9EA;border-radius:12px;height:52px;padding:0 16px}
.row i{width:20px;height:20px;border-radius:50%;border:2px solid #7A81A6}.row b{height:10px;border-radius:5px;background:#E6E9F3}
.row.on{border-color:#4F46E5;background:#F3F2FE}.row.on i{background:#4F46E5;border-color:#4F46E5;box-shadow:inset 0 0 0 4px #F3F2FE}
</style><div class="glow"></div><div class="left"><div class="brand">${mark}learivo</div>
${lockup ? "" : "<h1>Practise the way the exam asks.</h1><p>Your private question bank and exam practice, in sync on every device.</p>"}
</div><div class="card"><div class="q"></div><div class="q s"></div>${rows}</div>`;

async function shot(name, w, h, lockup) {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  await pg.setContent(page(w, h, lockup));
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: name });
  await b.close();
  execFileSync("python3", [
    "-c",
    `from PIL import Image;i=Image.open("${name}").convert("RGB").quantize(256,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.FLOYDSTEINBERG);i.save("${name}",optimize=True)`,
  ]);
}
mkdirSync("public/social", { recursive: true });
await shot("public/social/og-default.png", 1200, 630, false);
console.log("public/social/og-default.png written");
