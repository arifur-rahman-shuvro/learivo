import { useEffect, useId, useState } from "react";

/** A whole-number field that lets the student clear it while typing and fixes it on leaving. */
export function Num({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Math.round(Number(raw));
    if (raw.trim() !== "" && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    else setText(String(value));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        className="lv-input"
        inputMode="numeric"
        type="text"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isInteger(n) && n >= min && n <= max)
            onChange(n);
        }}
        onBlur={(e) => commit(e.target.value)}
        aria-describedby={`${id}-range`}
      />
      <span id={`${id}-range`} className="sr-only">
        {min} to {max}
      </span>
    </div>
  );
}
