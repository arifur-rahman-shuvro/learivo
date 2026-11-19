import { useGrown } from "../../motion/index.ts";

export function ProgressRing({
  value,
  size = 96,
  label,
}: {
  value: number;
  size?: number;
  label: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const grown = useGrown();
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      >
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--lv-surface-3)" strokeWidth="9" />
        <circle
          className="lv-ring-arc"
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--lv-accent)"
          strokeWidth="9"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (grown ? clamped : 0) / 100)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span
        className="absolute font-mono text-lg font-semibold"
        style={{ opacity: grown ? 1 : 0, transition: "opacity 600ms var(--lv-ease)" }}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
