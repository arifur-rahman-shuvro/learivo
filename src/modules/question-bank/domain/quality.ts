import { isOptionType, type QuestionInput } from "./model.ts";

/** Gentle suggestions about a question that is valid but could be better. They never block saving. */
export interface Hint {
  id: string;
  message: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

export function qualityHints(q: QuestionInput): Hint[] {
  const out: Hint[] = [];
  const stem = q.stem.trim();
  if (stem === "") return out;

  if (stem.split(/\s+/).length < 4 && q.qtype !== "fill_blank")
    out.push({
      id: "short-stem",
      message: "The statement is very short. Add the context a student needs.",
    });
  if (q.explanation.trim() === "")
    out.push({
      id: "no-explanation",
      message: "There is no explanation. It helps most when you revise a missed question.",
    });
  if (q.path.length === 0)
    out.push({
      id: "no-subject",
      message:
        "No subject yet. Without one, this question is left out of subject results and weak-area practice.",
    });

  if (isOptionType(q.qtype) && "options" in q.answer) {
    const options = q.answer.options.filter((o) => o.text.trim() !== "");
    const texts = options.map((o) => norm(o.text));
    if (new Set(texts).size < texts.length)
      out.push({ id: "same-options", message: "Two options say the same thing." });
    if (options.some((o) => /^(all|none) of the (above|these)$/i.test(o.text.trim())))
      out.push({
        id: "all-above",
        message:
          '"All of the above" and "none of the above" are weak options: a student can guess from the others.',
      });
    if (q.qtype !== "true_false") {
      const lengths = options.map((o) => o.text.trim().length);
      const correct = options.filter((o) => o.correct);
      if (options.length >= 3 && correct.length === 1) {
        const longest = Math.max(...lengths);
        const second = [...lengths].sort((a, b) => b - a)[1] ?? 0;
        if (correct[0]!.text.trim().length === longest && longest >= second * 2 && longest > 30)
          out.push({
            id: "long-answer",
            message:
              "The right answer is much longer than the others. Students learn to pick the longest.",
          });
      }
    }
    if (q.qtype === "multi_select" && options.filter((o) => o.correct).length === 1)
      out.push({
        id: "multi-one",
        message: "Only one option is correct. Is this a single-answer question?",
      });
    if (q.qtype === "true_false" && options.every((o) => o.correct))
      out.push({
        id: "tf-all-true",
        message: "Every statement is true. Add at least one false statement.",
      });
  }
  return out;
}
