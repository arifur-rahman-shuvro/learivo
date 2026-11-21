// Checks the built site (dist/) before it ships: the headers file is there with the rules we
// rely on, the app points at our own database project only, and no secret-looking key was
// bundled. Run after `pnpm build`.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const REF = "vmtbqoqyplsfmxyjcoiy";
const problems = [];

if (!existsSync("dist/index.html"))
  problems.push("dist/index.html is missing (run the build first)");
const headers = existsSync("dist/_headers") ? readFileSync("dist/_headers", "utf8") : "";
if (!headers) problems.push("dist/_headers is missing, so the security headers would not be sent");
for (const need of [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options: nosniff",
  "frame-ancestors 'none'",
  `https://${REF}.supabase.co`,
]) {
  if (headers && !headers.includes(need)) problems.push(`_headers does not contain: ${need}`);
}
if (/script-src[^;]*'unsafe-(inline|eval)'/.test(headers))
  problems.push("script-src allows unsafe-inline or unsafe-eval");

function* files(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}
const SECRET = [
  [/service_role/i, "a service_role key name"],
  [/sb_secret_[A-Za-z0-9_-]{10,}/, "a Supabase secret key"],
  [/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, "a signed token (JWT)"],
  [/postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/, "a database connection string"],
  [/sk-[A-Za-z0-9]{32,}/, "an AI provider key"],
];
const hosts = new Set();
for (const p of files("dist")) {
  if (!/\.(js|html|css|json|webmanifest|txt)$/.test(p)) continue;
  const text = readFileSync(p, "utf8");
  for (const [re, what] of SECRET) if (re.test(text)) problems.push(`${p} contains ${what}`);
  for (const m of text.matchAll(/https:\/\/([a-z0-9-]+)\.supabase\.co/g)) hosts.add(m[1]);
}
if (hosts.size === 0) problems.push("the app does not point at any Supabase project");
for (const h of hosts)
  if (h !== REF) problems.push(`the app mentions another Supabase project: ${h}`);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Build checked: headers present, only project ${REF}, no secret keys in ${"dist/"}`);
