/** The student's own profile: a name they choose and an avatar colour. */
export const AVATARS = [
  { id: "sky", label: "Sky", color: "#0369a1" },
  { id: "teal", label: "Teal", color: "#0f766e" },
  { id: "green", label: "Green", color: "#15803d" },
  { id: "amber", label: "Amber", color: "#b45309" },
  { id: "orange", label: "Orange", color: "#c2410c" },
  { id: "rose", label: "Rose", color: "#be123c" },
  { id: "violet", label: "Violet", color: "#6d28d9" },
  { id: "slate", label: "Slate", color: "#475569" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export interface Profile {
  displayName: string;
  avatar: AvatarId;
}

export const DEFAULT_PROFILE: Profile = { displayName: "", avatar: "sky" };
export const NAME_MAX = 40;

export const isAvatarId = (v: unknown): v is AvatarId => AVATARS.some((a) => a.id === v);

export const avatarColor = (id: AvatarId): string =>
  (AVATARS.find((a) => a.id === id) ?? AVATARS[0]).color;

/** Trims, collapses spaces and keeps at most NAME_MAX characters. */
export function cleanName(name: string): string {
  return Array.from(name.replace(/\s+/g, " ").trim()).slice(0, NAME_MAX).join("").trim();
}

export function cleanProfile(p: { displayName: string; avatar: string }): Profile {
  return { displayName: cleanName(p.displayName), avatar: isAvatarId(p.avatar) ? p.avatar : "sky" };
}

/** One or two capital letters from the name, or "" when there is no name. */
export function initials(name: string): string {
  const words = cleanName(name).split(" ").filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0]!)[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1]!)[0] ?? "") : "";
  return (first + last).toUpperCase();
}
