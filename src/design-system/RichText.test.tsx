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
