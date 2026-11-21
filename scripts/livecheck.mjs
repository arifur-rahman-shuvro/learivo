// Checks the live site and its database service from outside. Run by the scheduled "Live site
// check" workflow; a failure turns that workflow red and GitHub notifies the owner.
const SITE = process.env.SITE_URL ?? "https://learivo.pages.dev";
const REF = "vmtbqoqyplsfmxyjcoiy";
const KEY = "sb_publishable_swo9z1VNBvDjvrjt12FzJQ_ldW8crRa"; // public by design
const problems = [];
const ok = (cond, msg) => cond || problems.push(msg);

async function get(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

try {
  const res = await get(SITE);
  ok(res.status === 200, `site returned ${res.status}`);
  const html = await res.text();
  ok(/<div id="root">/.test(html), "site page has no app root");
  const h = (n) => res.headers.get(n) ?? "";
  ok(
    h("content-security-policy").includes("script-src 'self'"),
    "live CSP is missing script-src 'self'",
  );
  ok(
    !/script-src[^;]*'unsafe-(inline|eval)'/.test(h("content-security-policy")),
    "live CSP allows unsafe scripts",
  );
  ok(
    h("content-security-policy").includes(`${REF}.supabase.co`),
    "live CSP does not allow our database",
  );
  ok(h("strict-transport-security").includes("max-age"), "live site sends no HSTS");
  ok(h("x-content-type-options") === "nosniff", "live site lacks X-Content-Type-Options: nosniff");
  ok(h("x-frame-options").toUpperCase() === "DENY", "live site lacks X-Frame-Options: DENY");
  const sw = await get(`${SITE}/sw.js`);
  ok(sw.status === 200, `service worker returned ${sw.status}`);
  ok((sw.headers.get("cache-control") ?? "").includes("no-cache"), "service worker may be cached");
  const manifest = await get(`${SITE}/manifest.webmanifest`);
  ok(manifest.status === 200, `manifest returned ${manifest.status}`);
} catch (e) {
  problems.push(`site not reachable: ${e.message}`);
}

try {
  const auth = await get(`https://${REF}.supabase.co/auth/v1/health`, { headers: { apikey: KEY } });
  ok(auth.status === 200, `database sign-in service returned ${auth.status}`);
  // Signed out, a table must refuse to give anything (row-level security).
  const rows = await get(`https://${REF}.supabase.co/rest/v1/questions?select=id&limit=1`, {
    headers: { apikey: KEY },
  });
  const body = rows.ok ? await rows.json() : null;
  ok(
    !rows.ok || (Array.isArray(body) && body.length === 0),
    "a signed-out visitor can read questions",
  );
} catch (e) {
  problems.push(`database not reachable: ${e.message}`);
}

if (problems.length) {
  console.error(problems.map((p) => `FAIL ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Live check passed for ${SITE} and the database service`);
