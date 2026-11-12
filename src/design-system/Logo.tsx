interface LogoMarkProps {
  size?: number;
  /** Draw on a rounded-square gradient tile (app icon) instead of a bare mark. */
  tile?: boolean;
  title?: string;
}

/**
 * Learivo mark: an L whose upright stroke is a bookmark ribbon with a notched end,
 * finishing in a node that suggests a learning path. Colours come from theme tokens.
 */
export function LogoMark({ size = 32, tile = false, title = "Learivo" }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      {tile && (
        <>
          <defs>
            <linearGradient id="lv-tile" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--lv-accent)" />
              <stop offset="1" stopColor="var(--lv-chart-2)" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="16" fill="url(#lv-tile)" />
        </>
      )}
      <g fill={tile ? "var(--lv-accent-contrast)" : "var(--lv-accent)"}>
        {/* Ribbon upright with a notch at the bottom-left */}
        <path d="M17 10h10v30l-5-5-5 5z" />
        {/* Foot of the L */}
        <path d="M17 44h30a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4z" />
        {/* Path node */}
        <circle cx="47" cy="22" r="6" />
      </g>
    </svg>
  );
}

export function LogoWordmark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{ fontFamily: "var(--lv-font-heading)" }}
    >
      <LogoMark size={size} />
      <span style={{ fontSize: size * 0.72, fontWeight: 700, letterSpacing: "-0.02em" }}>
        learivo
      </span>
    </span>
  );
}
