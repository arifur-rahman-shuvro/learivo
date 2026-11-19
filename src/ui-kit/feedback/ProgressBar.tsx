import { useGrown } from "../../motion/index.ts";

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const grown = useGrown();
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-3"
    >
      <div
        className="h-full rounded-pill bg-accent"
        style={{
          width: `${grown ? clamped : 0}%`,
          transition: "width 600ms var(--lv-ease)",
        }}
      />
    </div>
  );
}
