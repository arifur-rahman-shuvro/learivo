import { REASONS, type Reason } from "./reasons.ts";
import type { Past } from "./session.ts";

/**
 * Ways to group the questions that need work. "wrong" is every question last answered wrong; the
 * reasons split it by what the student said went wrong; "overconfident" and "shaky" come from the
 * confidence given on the latest answer.
 */
export type MistakeGroup = "wrong" | Reason | "overconfident" | "shaky";

export const MISTAKE_GROUPS: readonly { id: MistakeGroup; label: string }[] = [
  { id: "wrong", label: "All missed" },
  ...REASONS.map((r) => ({ id: r.id, label: r.label })),
  { id: "overconfident", label: "Sure but wrong" },
  { id: "shaky", label: "Right but unsure" },
];

export function inGroup(p: Past | undefined, group: MistakeGroup): boolean {
  if (!p) return false;
  const wrong = p.last === "wrong";
  switch (group) {
    case "wrong":
      return wrong;
    case "overconfident":
      return wrong && p.confidence === "sure";
    case "shaky":
      return !wrong && (p.confidence === "unsure" || p.confidence === "guess");
    default:
      return wrong && p.reason === group;
  }
}
