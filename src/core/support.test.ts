import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL, noteError, recentErrors, supportMailto } from "./support.ts";

const decode = (url: string) => {
  const u = new URL(url);
  return {
    to: u.pathname,
    subject: u.searchParams.get("subject"),
    body: u.searchParams.get("body") ?? "",
  };
};

describe("support email", () => {
  it("opens an email to the support address with technical details only", () => {
    noteError(new Error("Could not reach your question bank"));
    const m = decode(supportMailto("problem"));
    expect(m.to).toBe(SUPPORT_EMAIL);
    expect(m.subject).toBe("Learivo: problem report");
    expect(m.body).toContain("Browser:");
    expect(m.body).toContain("Could not reach your question bank");
    expect(m.body).toContain("do not write passwords");
    expect(decode(supportMailto("feedback")).subject).toBe("Learivo: feedback");
  });

  it("keeps only the last eight short errors", () => {
    for (let i = 0; i < 12; i++) noteError(`failure number ${i} ${"x".repeat(400)}`);
    expect(recentErrors()).toHaveLength(8);
    expect(recentErrors()[7]!.text.length).toBeLessThanOrEqual(160);
    expect(recentErrors()[7]!.text).toContain("failure number 11");
  });
});
