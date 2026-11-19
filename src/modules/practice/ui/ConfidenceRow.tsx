import { CONFIDENCE, type Confidence } from "../domain/confidence.ts";

interface Props {
  value: Confidence | null;
  /** Turned off once the answer has been checked, so confidence is always given before the result. */
  disabled?: boolean;
  onChange: (value: Confidence | null) => void;
}

/** "How sure are you?" under an answer. Optional; tapping the chosen one again clears it. */
export default function ConfidenceRow({ value, disabled, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id="confidence-label" className="text-sm font-semibold text-muted">
        How sure are you?
      </span>
      <div role="radiogroup" aria-labelledby="confidence-label" className="flex flex-wrap gap-2">
        {CONFIDENCE.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value === c.id}
            disabled={disabled}
            title={c.hint}
            onClick={() => onChange(value === c.id ? null : c.id)}
            className={`min-h-[40px] rounded-pill border px-3.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
              value === c.id ? "border-accent bg-surface-2" : "border-line text-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
