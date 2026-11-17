import { useId } from "react";

export interface SegmentOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  options: readonly SegmentOption[];
  onChange: (value: string) => void;
  hideLabel?: boolean;
  className?: string;
}

/**
 * A short row of choices where one is always on (True / False, None / Short / Detailed). A
 * highlight slides to the chosen segment. Use a Picker when there are more than about five.
 */
export function Segmented({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  className = "",
}: Props) {
  const id = useId();
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const move = (e: React.KeyboardEvent, i: number) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(i + step + options.length) % options.length]!;
    onChange(next.value);
    document.getElementById(`${id}-${next.value}`)?.focus();
  };
  return (
    <div className={`flex flex-col gap-1.5 text-sm font-semibold ${className}`}>
      <span className={hideLabel ? "sr-only" : ""} id={`${id}-label`}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="relative grid rounded-control border border-line bg-surface-2 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1 top-1 rounded-control bg-accent shadow-sm transition-transform duration-200 ease-out"
          style={{
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
        {options.map((o, i) => {
          const on = i === index;
          return (
            <button
              key={o.value}
              id={`${id}-${o.value}`}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => move(e, i)}
              className={`relative z-10 min-h-10 rounded-control px-2 text-center font-semibold transition-colors duration-200 ${
                on ? "text-on-accent" : "text-muted hover:text-fg"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
