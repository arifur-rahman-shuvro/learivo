import { isOptionType, type QuestionInput } from "./model.ts";
import type { Hint } from "./quality.ts";

/**
 * Checks aimed at questions written by AI. They look for things that are very often wrong in
 * generated questions: a wrong answer key, an explanation that argues for a different option,
 * confusing negatives, and invented numbers. They are rules of thumb. They cannot tell whether
 * a fact is true, so a question that passes is not "verified": the student still checks it.
 */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** True when `text` (already normalised) appears in `haystack` (normalised) as whole words. */
function mentions(haystack: string, text: string): boolean {
  if (text.length < 4) return false;
  return ` ${haystack} `.includes(` ${text} `);
}

const NEGATIVE = /\b(not|except|incorrect|false|least|never|unlikely|cannot)\b/i;
const FIGURE =
  /\b\d+(\.\d+)?\s?(mg|mcg|µg|g|kg|ml|l|mmol|mol|mmhg|%|percent|units?|hours?|days?|weeks?|years?)\b|\b(19|20)\d{2}\b/i;
const CITATION = /\b(et al\.?|according to|study|trial|guideline|journal|published)\b/i;
const ABSOLUTE = /\b(always|never|all|none|only|every|must|completely|entirely)\b/i;

export function reviewHints(q: QuestionInput): Hint[] {
  const out: Hint[] = [];
  const stem = q.stem.trim();
  if (stem === "") return out;
  const explanation = norm(q.explanation);

  if (q.qtype === "fill_blank" && "blanks" in q.answer) {
    if (q.answer.blanks.some((b) => b.accepted.every((a) => a.trim() === "")))
      out.push({ id: "blank-empty", level: "check", message: "A blank has no accepted answer." });
  }

  if (isOptionType(q.qtype) && "options" in q.answer) {
    const options = q.answer.options.filter((o) => o.text.trim() !== "");
    const correct = options.filter((o) => o.correct);
    const wrong = options.filter((o) => !o.correct);

    // Answer key.
    if (correct.length === 0)
      out.push({ id: "no-key", level: "check", message: "No option is marked correct." });
    else if (q.qtype !== "multi_select" && q.qtype !== "true_false" && correct.length > 1)
      out.push({
        id: "many-keys",
        level: "check",
        message: "More than one option is marked correct in a single-answer question.",
      });
    if (q.qtype !== "true_false" && options.length < 3)
      out.push({
        id: "few-options",
        message:
          "Only two options means a 50% guess. Three to five options make a better question.",
      });

    // The explanation should support the key, not another option.
    if (explanation !== "" && correct.length > 0 && wrong.length > 0 && q.qtype !== "true_false") {
      // An option is "named" by its full text, or by a word only that option uses.
      type Opt = (typeof options)[number];
      const words = (o: Opt) => norm(o.text).split(" ");
      const distinct = (o: Opt) =>
        words(o).filter(
          (w) => w.length >= 5 && options.every((p) => p === o || !words(p).includes(w)),
        );
      const named = (o: Opt) =>
        mentions(explanation, norm(o.text)) || distinct(o).some((w) => mentions(explanation, w));
      const names = (list: Opt[]) => list.filter(named);
      const forWrong = names(wrong);
      if (names(correct).length === 0 && forWrong.length > 0)
        out.push({
          id: "explanation-other",
          level: "check",
          message: `The explanation talks about "${forWrong[0]!.text.slice(0, 40)}" but not the option marked correct. Is the answer key right?`,
        });
    }

    // One option contained in another: both can read as right.
    const texts = options.map((o) => norm(o.text));
    const contained = texts.some((a, i) =>
      texts.some((b, j) => i !== j && a.length >= 4 && a !== b && ` ${b} `.includes(` ${a} `)),
    );
    if (contained)
      out.push({
        id: "option-inside-option",
        message:
          "One option is part of another, so both could look right. Make them clearly different.",
      });

    // Absolute words in only some options are a giveaway; in a correct one they are often false.
    if (q.qtype !== "multi_select" && correct.some((o) => ABSOLUTE.test(o.text)))
      out.push({
        id: "absolute-key",
        message:
          'The right answer uses an absolute word such as "always", "only" or "never". These are often false in generated questions.',
      });
  }

  if (NEGATIVE.test(stem) && !/\b(NOT|EXCEPT|FALSE|INCORRECT|LEAST)\b/.test(stem))
    out.push({
      id: "negative-stem",
      message:
        "The statement is worded as a negative. Put NOT or EXCEPT in capitals so it is not misread.",
    });

  const all = [
    stem,
    q.explanation,
    ...(("options" in q.answer && q.answer.options.map((o) => o.text)) || []),
  ].join(" ");
  if (FIGURE.test(all) || CITATION.test(all))
    out.push({
      id: "check-facts",
      message:
        "It contains figures, dates or sources. AI can invent these: check them against your own notes or book.",
    });

  return out;
}

/** Every suggestion for one question: the general ones and the AI-focused ones. */
export function allHints(q: QuestionInput, general: readonly Hint[]): Hint[] {
  return [...general, ...reviewHints(q)];
}

export interface QualitySummary {
  total: number;
  /** Questions with at least one "check" finding. */
  needLook: number;
  /** Questions with only tips. */
  tipsOnly: number;
  clean: number;
}

export function summarise(hintsPerQuestion: readonly (readonly Hint[])[]): QualitySummary {
  let needLook = 0;
  let tipsOnly = 0;
  for (const h of hintsPerQuestion) {
    if (h.some((x) => x.level === "check")) needLook++;
    else if (h.length > 0) tipsOnly++;
  }
  return {
    total: hintsPerQuestion.length,
    needLook,
    tipsOnly,
    clean: hintsPerQuestion.length - needLook - tipsOnly,
  };
}
