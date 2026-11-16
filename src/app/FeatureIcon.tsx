import type { ReactNode } from "react";
import type { FeatureIcon as Name } from "./features.ts";

/** Hand-drawn 24px line icons, one per feature. Decorative: the title next to each carries the meaning. */
const PATHS: Record<Name, ReactNode> = {
  bank: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  add: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  prompt: (
    <>
      <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="m9 9 2 2-2 2M13 13h3" />
    </>
  ),
  subjects: (
    <>
      <path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M12 10v6M9 13h6" />
    </>
  ),
  export: (
    <>
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  practice: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.5 5 3.5-5 3.500Z" />
    </>
  ),
  exam: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9.5 2h5" />
    </>
  ),
  due: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="m9.5 15 2 2 3.5-3.5" />
    </>
  ),
  mistakes: (
    <>
      <path d="M6 3h9l4 4v14H6Z" />
      <path d="m10 11 4 4M14 11l-4 4" />
    </>
  ),
  bookmarks: <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />,
  notes: (
    <>
      <path d="M5 3h11l3 3v15H5Z" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  flashcards: (
    <>
      <rect x="3" y="7" width="14" height="12" rx="2" />
      <path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    </>
  ),
  glossary: (
    <>
      <path d="M5 4a2 2 0 0 1 2-2h12v18H7a2 2 0 0 0-2 2Z" />
      <path d="M5 20V4M10 7h5" />
    </>
  ),
  insights: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="m8 15 4-5 3 3 4-6" />
    </>
  ),
  achievements: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="m8.5 14-1.5 7 5-3 5 3-1.5-7" />
    </>
  ),
  goal: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  guide: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.500a2.5 2.5 0 1 1 3.5 2.300c-.700.4-1 .900-1 1.700M12 17h.01" />
    </>
  ),
};

export function FeatureIcon({ name, size = 24 }: { name: Name; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
