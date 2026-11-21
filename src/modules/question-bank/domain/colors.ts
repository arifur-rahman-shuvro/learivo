/** The colours a subject can have. Names are stored; the shades are chosen here so they show on light and dark themes. */
export const SUBJECT_COLORS = [
  { id: "red", label: "Red", css: "#e5484d" },
  { id: "orange", label: "Orange", css: "#f76b15" },
  { id: "amber", label: "Amber", css: "#e2a400" },
  { id: "green", label: "Green", css: "#30a46c" },
  { id: "teal", label: "Teal", css: "#12a594" },
  { id: "blue", label: "Blue", css: "#3e63dd" },
  { id: "violet", label: "Violet", css: "#8e4ec6" },
  { id: "pink", label: "Pink", css: "#d6409f" },
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number]["id"];

export function isSubjectColor(v: unknown): v is SubjectColor {
  return SUBJECT_COLORS.some((c) => c.id === v);
}

/** The shade for a stored colour name, or undefined for none or an unknown name. */
export function colorCss(v: string | null | undefined): string | undefined {
  return SUBJECT_COLORS.find((c) => c.id === v)?.css;
}
