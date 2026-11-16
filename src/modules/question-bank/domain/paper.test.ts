import { describe, expect, it } from "vitest";
import { blankQuestion, type QuestionInput } from "./model.ts";
import { answerText, paperHtml } from "./paper.ts";

const opts = (rows: [string, boolean][]) => ({
  options: rows.map(([text, correct]) => ({ text, correct })),
});
const sba: QuestionInput = {
  ...blankQuestion("sba"),
  stem: "Pick <b>B</b>",
  answer: opts([
    ["One", false],
    ["Two", true],
  ]),
  explanation: "Because two.",
};
const tf: QuestionInput = {
  ...blankQuestion("true_false"),
  stem: "Facts:",
  answer: opts([
    ["Sky is blue", true],
    ["Fire is cold", false],
  ]),
};
const fill: QuestionInput = {
  ...blankQuestion("fill_blank"),
  stem: "Plants use {{1}} for food.",
  answer: { blanks: [{ accepted: ["sunlight", "light"] }] },
};
const multi: QuestionInput = {
  ...blankQuestion("multi_select"),
  stem: "Primes",
  answer: opts([
    ["2", true],
    ["4", false],
    ["5", true],
  ]),
};

describe("printable paper", () => {
  it("writes the answers in a short form", () => {
    expect(answerText(sba)).toBe("B");
    expect(answerText(multi)).toBe("A, C");
    expect(answerText(tf)).toBe("1) True   2) False");
    expect(answerText(fill)).toBe("1) sunlight / light");
  });

  it("escapes what the student typed and blanks out fill-in answers", () => {
    const html = paperHtml([sba, fill], {
      title: "<script>x</script>",
      key: false,
      explanations: false,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;B&lt;/b&gt;");
    expect(html).toContain("Plants use __________ for food.");
    expect(html).not.toContain("sunlight");
    expect(html).not.toContain("Answer key");
  });

  it("adds an answer key, with explanations only when asked", () => {
    const plain = paperHtml([sba, multi], { title: "Quiz", key: true, explanations: false });
    expect(plain).toContain("Answer key");
    expect(plain).not.toContain("Because two.");
    const full = paperHtml([sba, multi], { title: "Quiz", key: true, explanations: true });
    expect(full).toContain("Because two.");
    expect(full).toContain("Choose all that apply.");
  });
});
