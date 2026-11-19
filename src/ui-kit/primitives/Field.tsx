import { useId, type InputHTMLAttributes } from "react";
import { cx } from "../cx.ts";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, id, className, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy =
    [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        className="lv-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
