import { BLANK_PATTERN } from "../../question-bank/domain/model.ts";
import type { FlashcardInput } from "../../workspace/domain/cards.ts";
import type { Snapshot } from "./grading.ts";

const FRONT_MAX = 2000;
const BACK_MAX = 5000;

const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/**
 * A front-and-back flashcard from a question the student missed or skipped. The front is the
 * question, the back is the right answer and the explanation, so it can be revised by recall.
 */
export function cardFromSnapshot(s: Snapshot): { front: string; back: string } {
  const a = s.answer;
  let front = s.stem.replace(BLANK_PATTERN, "_____").trim();
  let answer: string;
  if ("blanks" in a) {
    answer = a.blanks
      .map((b, i) => (a.blanks.length > 1 ? `${i + 1}. ` : "") + b.accepted.join(" or "))
      .join("\n");
    answer = `Answer: ${answer}`;
  } else if (s.qtype === "true_false") {
    front += `\n${a.options.map((o, i) => `${i + 1}. ${o.text}`).join("\n")}`;
    answer = a.options.map((o, i) => `${i + 1}. ${o.correct ? "True" : "False"}`).join("\n");
  } else {
    const right = a.options.filter((o) => o.correct).map((o) => o.text);
    answer = right.length > 1 ? `Answers:\n- ${right.join("\n- ")}` : `Answer: ${right[0] ?? ""}`;
  }
  const why = s.explanation.trim();
  return {
    front: cut(front, FRONT_MAX),
    back: cut(why ? `${answer}\n\n${why}` : answer, BACK_MAX),
  };
}

/** Cards for the questions that do not have one yet, matched by the front text. */
export function newAutoCards(
  snapshots: readonly Snapshot[],
  existingFronts: ReadonlySet<string>,
): FlashcardInput[] {
  const seen = new Set(existingFronts);
  const out: FlashcardInput[] = [];
  for (const s of snapshots) {
    const { front, back } = cardFromSnapshot(s);
    if (front === "" || back === "" || seen.has(front)) continue;
    seen.add(front);
    out.push({ id: null, front, back });
  }
  return out;
}
