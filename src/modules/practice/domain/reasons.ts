/** Why a student missed a question, chosen by the student after a session. */
export const REASONS = [
  { id: "careless", label: "Careless", hint: "I knew it but slipped (misread, wrong tick)." },
  { id: "not_known", label: "Did not know", hint: "I had not learned this yet." },
  { id: "mixed_up", label: "Mixed up", hint: "I confused it with something similar." },
  { id: "guessed", label: "Guessed", hint: "I picked without being sure." },
] as const;

export type Reason = (typeof REASONS)[number]["id"];

export const isReason = (v: unknown): v is Reason => REASONS.some((r) => r.id === v);
export const reasonLabel = (r: Reason) => REASONS.find((x) => x.id === r)!.label;
