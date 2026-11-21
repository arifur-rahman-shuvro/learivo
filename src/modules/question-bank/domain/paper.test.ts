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
    expect(answerText(tf)).toBe("a) True   b) False");
    expect(answerText(fill)).toBe("1) sunlight / light");
  });

  it("escapes what the student typed and blanks out fill-in answers", () => {
    const html = paperHtml([sba, fill], {
      title: "<script>x</script>",
      key: false,
      explanations: false,
    });
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;B&lt;/b&gt;");
    expect(html).toContain("Plants use __________ for food.");
    expect(html).not.toContain("sunlight");
    expect(html).not.toContain("Answer key");
    // Without a key the page carries no answers at all, not even hidden ones.
    expect(html).not.toContain('data-ok="');
    expect(html).not.toContain("Because two.");
    expect(html).not.toContain("Check my answers");
  });

  it("keeps a title from breaking out of the page footer style", () => {
    const html = paperHtml([sba], { title: 'x"}</style><b>', key: false, explanations: false });
    expect(html.match(/<\/style>/g)).toHaveLength(1);
    expect(html).not.toContain("<b>x");
  });

  it("puts the answer key on its own page, after every question", () => {
    const html = paperHtml([sba, multi], { title: "Quiz", key: true, explanations: true });
    const key = html.indexOf('<main class="keypage">');
    expect(key).toBeGreaterThan(html.indexOf('id="q2"'));
    expect(html).toContain(".keypage { break-before: page; }");
    // Explanations are on a further page of their own.
    expect(html.indexOf('<main class="whypage">')).toBeGreaterThan(key);
    expect(html).toContain("Check my answers");
  });

  it("leaves out the explanations page when nothing is explained", () => {
    const html = paperHtml([multi], { title: "Quiz", key: true, explanations: true });
    expect(html).not.toContain('<main class="whypage">');
  });

  it("adds an answer key, with explanations only when asked", () => {
    const plain = paperHtml([sba, multi], { title: "Quiz", key: true, explanations: false });
    expect(plain).toContain("Answer key");
    expect(plain).not.toContain("Because two.");
    const full = paperHtml([sba, multi], { title: "Quiz", key: true, explanations: true });
    expect(full).toContain("Because two.");
    expect(full).toContain("Choose all that apply.");
  });

  it("lays out an exam with its details and one section per type", () => {
    const html = paperHtml([fill, sba, tf, multi], {
      title: "Mock 1",
      key: true,
      explanations: false,
      exam: {
        instructions: "Answer all questions.",
        minutes: 90,
        marksCorrect: 2,
        marksWrong: 0.5,
      },
    });
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toContain("4 questions");
    expect(text).toContain("Total marks: 8");
    expect(text).toContain("Time: 90 minutes");
    expect(text).toContain("0.5 deducted for each wrong answer");
    expect(html).toContain("Answer all questions.");
    const order = ["Section A", "Section B", "Section C", "Section D"].map((x) => html.indexOf(x));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html.indexOf("Pick <b>B</b>".replace(/</g, "&lt;").replace(/>/g, "&gt;"))).toBeLessThan(
      html.indexOf("Primes"),
    );
    // The key follows the printed order: the single-best-answer question comes first.
    expect(html.indexOf("<span>B</span>")).toBeGreaterThan(html.indexOf("Answer key"));
  });

  it("says no time limit for an untimed exam", () => {
    const html = paperHtml([sba], {
      title: "T",
      key: false,
      explanations: false,
      exam: { instructions: "", minutes: null, marksCorrect: 1, marksWrong: 0 },
    });
    expect(html.replace(/<[^>]+>/g, "")).toContain("No time limit");
    expect(html).not.toContain("deducted");
  });
});
