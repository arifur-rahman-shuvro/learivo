import type { ReactNode } from "react";
import type { ThemeId } from "./types.ts";

/**
 * Theme slots: the few visual parts that must differ structurally between themes,
 * not only in colour. Components render the slot; the theme decides what it looks like.
 */
export interface ThemeSlots {
  /** Decorative layer behind the app. Must never receive pointer events. */
  Background: () => ReactNode;
  /** Loading indicator. */
  Loader: (props: { size?: number }) => ReactNode;
  /** Illustration for empty states. */
  EmptyArt: () => ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const DefaultSlots: ThemeSlots = {
  Background: () => null,
  Loader: ({ size = 28 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="lv-spin"
      role="img"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9" {...stroke} opacity="0.2" />
      <path d="M12 3a9 9 0 0 1 9 9" {...stroke} />
    </svg>
  ),
  EmptyArt: () => (
    <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden="true">
      <rect
        x="18"
        y="22"
        width="84"
        height="56"
        rx="12"
        fill="var(--lv-surface-2)"
        stroke="var(--lv-border-strong)"
        strokeWidth="1.5"
      />
      <rect x="30" y="36" width="40" height="6" rx="3" fill="var(--lv-border-strong)" />
      <rect x="30" y="50" width="60" height="6" rx="3" fill="var(--lv-border)" />
      <circle cx="92" cy="24" r="12" fill="var(--lv-accent)" />
      <path
        d="M86.5 24.5l4 4 7-8"
        fill="none"
        stroke="var(--lv-accent-contrast)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

const ForestSlots: ThemeSlots = {
  Background: () => (
    <svg
      className="lv-bg-art"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {/* Distant tree line */}
      <g fill="var(--lv-accent)" opacity="0.10">
        <path d="M0 800V640l30-70 30 70 30-90 34 100 36-120 40 140 30-80 36 110 34-100 30 80 40-90 30 90V800z" />
      </g>
      {/* Drifting leaves */}
      <g fill="var(--lv-accent)" opacity="0.16">
        <path className="lv-drift" d="M60 120c18-6 34 6 36 22-18 6-34-6-36-22z" />
        <path className="lv-drift lv-drift-b" d="M300 220c18-6 34 6 36 22-18 6-34-6-36-22z" />
        <path className="lv-drift lv-drift-c" d="M180 420c18-6 34 6 36 22-18 6-34-6-36-22z" />
      </g>
    </svg>
  ),
  Loader: ({ size = 28 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="lv-sway"
      role="img"
      aria-label="Loading"
    >
      <path d="M12 21V11" {...stroke} />
      <path d="M12 12C12 7 8 4.5 4 5c0 4.5 3 7.5 8 7z" fill="var(--lv-accent)" opacity="0.9" />
      <path d="M12 15c0-4 3-6.5 8-6.5 0 4.2-3 6.8-8 6.5z" fill="var(--lv-accent)" opacity="0.55" />
    </svg>
  ),
  EmptyArt: () => (
    <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden="true">
      <path d="M60 88V46" stroke="var(--lv-border-strong)" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 52C60 30 42 18 22 20c0 20 14 34 38 32z" fill="var(--lv-accent)" opacity="0.85" />
      <path d="M60 64c0-18 14-28 36-28 0 18-14 30-36 28z" fill="var(--lv-accent)" opacity="0.5" />
      <ellipse cx="60" cy="90" rx="32" ry="4" fill="var(--lv-surface-3)" />
    </svg>
  ),
};

const SpaceSlots: ThemeSlots = {
  Background: () => (
    <svg
      className="lv-bg-art"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="var(--lv-accent)" opacity="0.10">
        <ellipse cx="330" cy="120" rx="150" ry="46" transform="rotate(-24 330 120)" />
        <ellipse cx="330" cy="120" rx="210" ry="70" transform="rotate(-24 330 120)" />
      </g>
      <circle cx="330" cy="120" r="26" fill="var(--lv-chart-2)" opacity="0.16" />
    </svg>
  ),
  Loader: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Loading">
      <ellipse
        cx="12"
        cy="12"
        rx="9.5"
        ry="4"
        {...stroke}
        opacity="0.35"
        transform="rotate(-25 12 12)"
      />
      <circle cx="12" cy="12" r="2.6" fill="var(--lv-accent)" />
      <g className="lv-orbit">
        <circle cx="21" cy="12" r="1.8" fill="var(--lv-text)" />
      </g>
    </svg>
  ),
  EmptyArt: () => (
    <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden="true">
      <ellipse
        cx="60"
        cy="52"
        rx="48"
        ry="14"
        fill="none"
        stroke="var(--lv-border-strong)"
        strokeWidth="1.5"
        transform="rotate(-18 60 52)"
      />
      <circle cx="60" cy="48" r="20" fill="var(--lv-accent)" opacity="0.9" />
      <circle cx="94" cy="40" r="4" fill="var(--lv-text)" />
      <circle cx="22" cy="22" r="1.6" fill="var(--lv-text)" opacity="0.8" />
      <circle cx="100" cy="14" r="1.2" fill="var(--lv-text)" opacity="0.6" />
    </svg>
  ),
};

export const slots: Record<ThemeId, ThemeSlots> = {
  default: DefaultSlots,
  forest: ForestSlots,
  space: SpaceSlots,
};
