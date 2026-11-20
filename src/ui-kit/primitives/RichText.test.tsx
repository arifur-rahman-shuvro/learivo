import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RichText, blocks } from "./RichText.tsx";

afterEach(cleanup);

describe("RichText", () => {
  it("formats bold, italic, code and bullet lists", () => {
    const { container } = render(
      <RichText text={"A **bold** and *soft* word with `x=1`\n\n- one\n- two"} />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("soft");
    expect(container.querySelector("code")?.textContent).toBe("x=1");
    expect([...container.querySelectorAll("li")].map((l) => l.textContent)).toEqual(["one", "two"]);
  });

  it("never turns text into HTML", () => {
    const evil = '<img src=x onerror="alert(1)"> <script>alert(2)</script> **ok**';
    const { container } = render(<RichText text={evil} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(2)</script>");
    expect(container.querySelector("strong")?.textContent).toBe("ok");
  });

  it("keeps single line breaks and splits paragraphs on blank lines", () => {
    expect(blocks("a\nb\n\nc")).toEqual([
      { kind: "p", lines: ["a", "b"] },
      { kind: "p", lines: ["c"] },
    ]);
  });

  it("leaves unmatched markers alone", () => {
    const { container } = render(<RichText text="2 * 3 and ** alone" />);
    expect(container.textContent).toBe("2 * 3 and ** alone");
  });
});

describe("RichText with hostile text", () => {
  const payloads = [
    "<script>window.hacked = 1</script>",
    '<img src=x onerror="window.hacked = 1">',
    "**<b onmouseover=alert(1)>bold</b>**",
    "[click](javascript:alert(1))",
    '`<iframe src="https://evil.test"></iframe>`',
    "- <svg onload=alert(1)>",
    '"><script>alert(1)</script>',
  ];
  it("shows every payload as plain text and creates no element from it", () => {
    for (const p of payloads) {
      const { container, unmount } = render(<RichText text={p} />);
      expect(
        container.querySelector("script, img, iframe, svg, a, [onerror], [onload], [onmouseover]"),
      ).toBeNull();
      expect((window as unknown as { hacked?: number }).hacked).toBeUndefined();
      expect(container.textContent).toContain(
        p.replace(/[*`]/g, "").replace(/^- /, "").slice(0, 8),
      );
      unmount();
    }
  });
});
