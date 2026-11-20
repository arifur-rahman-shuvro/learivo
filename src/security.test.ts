import { describe, expect, it } from "vitest";
import headers from "../public/_headers?raw";
import indexHtml from "../index.html?raw";

/** Every app source file except tests, as text. */
const sources = Object.entries(
  import.meta.glob<string>(["./**/*.ts", "./**/*.tsx", "!./**/*.test.ts", "!./**/*.test.tsx"], {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

describe("code that could let text run as script", () => {
  const banned: [string, RegExp][] = [
    ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
    ["innerHTML or outerHTML", /\.(inner|outer)HTML\b/],
    ["insertAdjacentHTML", /insertAdjacentHTML/],
    ["document.write", /document\.write\s*\(/],
    ["eval", /\beval\s*\(/],
    ["new Function", /new Function\s*\(/],
    ["a javascript: link", /javascript:/i],
    ["setTimeout with a string", /set(Timeout|Interval)\(\s*["'`]/],
  ];
  it.each(banned)("never uses %s", (_name, re) => {
    const hits = sources.filter(([, text]) => re.test(text)).map(([file]) => file);
    expect(hits).toEqual([]);
  });

  it("only builds links to addresses written in the code, never from student content", () => {
    const hits = sources.filter(([, text]) => /<a\s[^>]*href=\{/.test(text)).map(([file]) => file);
    // The AI connection dialog links to each provider's key page from a fixed table.
    expect(hits).toEqual(["./modules/ai/AiConnectionDialog.tsx"]);
  });
});

describe("security headers", () => {
  const rule = (name: string) =>
    new RegExp(`^\\s*${name}:\\s*(.+)$`, "mi").exec(headers)?.[1]?.trim() ?? "";
  const csp = rule("Content-Security-Policy");
  const directive = (name: string) =>
    csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${name} `) || d === name) ?? "";

  it("ships the basic protections", () => {
    expect(rule("X-Content-Type-Options")).toBe("nosniff");
    expect(rule("X-Frame-Options")).toBe("DENY");
    expect(rule("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(rule("Strict-Transport-Security")).toMatch(/max-age=\d{7,}/);
    expect(rule("Permissions-Policy")).toMatch(/camera=\(\).*microphone=\(\)/);
  });

  it("lets only our own scripts run", () => {
    const script = directive("script-src");
    expect(script).toBe("script-src 'self'");
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("form-action")).toBe("form-action 'self'");
    expect(directive("default-src")).toBe("default-src 'self'");
    expect(csp).toMatch(/upgrade-insecure-requests/);
  });

  it("allows connections only to named secure addresses", () => {
    const origins = directive("connect-src").split(/\s+/).slice(1);
    expect(origins).toContain("'self'");
    for (const o of origins.filter((x) => x !== "'self'")) {
      expect(o, o).toMatch(/^https:\/\/[a-z0-9.*-]+\.[a-z]+$/);
    }
    expect(origins).not.toContain("*");
    expect(origins).not.toContain("https:");
  });

  it("has no inline script in the page, which the policy would block anyway", () => {
    const inline = [...indexHtml.matchAll(/<script\b([^>]*)>/gi)].filter(
      (m) => !/\bsrc=/.test(m[1]!),
    );
    expect(inline).toEqual([]);
  });

  it("keeps the service worker and manifest fresh", () => {
    expect(headers).toMatch(/\/sw\.js\s+Cache-Control: no-cache/);
  });
});
