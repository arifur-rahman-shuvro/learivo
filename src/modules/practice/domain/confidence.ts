/** How sure the student was about an answer, picked while answering. Optional. */
export const CONFIDENCE = [
  { id: "sure", label: "Sure", hint: "I am confident in this answer." },
  { id: "unsure", label: "Not sure", hint: "I lean this way but could be wrong." },
  { id: "guess", label: "Guess", hint: "I am picking without knowing." },
] as const;

export type Confidence = (typeof CONFIDENCE)[number]["id"];

export const confidenceLabel = (c: Confidence) => CONFIDENCE.find((x) => x.id === c)!.label;

/**
 * What an answer says about how well the student knows the topic, from the result and the
 * confidence together:
 *   solid          right and sure
 *   overconfident  wrong but sure: a wrong belief, the most important thing to fix
 *   shaky          right but unsure or guessed: may be luck, worth revising
 *   gap            wrong and unsure or guessed: a known gap
 */
export type Calibration = "solid" | "overconfident" | "shaky" | "gap";

export function calibration(
  correct: boolean,
  confidence: Confidence | null | undefined,
): Calibration | null {
  if (!confidence) return null;
  if (confidence === "sure") return correct ? "solid" : "overconfident";
  return correct ? "shaky" : "gap";
}

export const CALIBRATION_LABEL: Record<Calibration, string> = {
  solid: "Sure and right",
  overconfident: "Sure but wrong",
  shaky: "Right but unsure",
  gap: "Wrong and unsure",
};

export interface CalibrationCounts {
  /** Answers where the student gave a confidence. */
  rated: number;
  solid: number;
  overconfident: number;
  shaky: number;
  gap: number;
}

/** Counts how a set of answers split by calibration. Skipped questions are left out. */
export function countCalibration(
  answers: readonly { correct: boolean; confidence?: Confidence | null }[],
): CalibrationCounts {
  const out: CalibrationCounts = { rated: 0, solid: 0, overconfident: 0, shaky: 0, gap: 0 };
  for (const a of answers) {
    const k = calibration(a.correct, a.confidence);
    if (!k) continue;
    out.rated += 1;
    out[k] += 1;
  }
  return out;
}
