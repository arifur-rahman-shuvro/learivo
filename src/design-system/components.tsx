import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { useTheme } from "../themes/ThemeProvider.tsx";
import { slots } from "../themes/slots.tsx";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/* ---------- Button ---------- */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "md", loading = false, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("lv-btn", `lv-btn-${variant}`, size !== "md" && `lv-btn-${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={18} inherit /> : icon}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  interactive?: boolean;
}

export function Card({ raised, interactive, className, ...rest }: CardProps) {
  return <div className={cx("lv-card", raised && "lv-card-raised", interactive && "lv-card-interactive", className)} {...rest} />;
}

/* ---------- Field (labelled input with error) ---------- */
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, id, className, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <input id={inputId} className="lv-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
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

/* ---------- Badge ---------- */
type Tone = "neutral" | "success" | "warning" | "danger" | "accent";
const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg border-line-strong",
  accent: "bg-surface-2 text-accent border-accent",
  success: "bg-surface-2 text-success border-success",
  warning: "bg-surface-2 text-warning border-warning",
  danger: "bg-surface-2 text-danger border-danger",
};

export function Badge({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cx("inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-semibold", toneClass[tone], className)}
      {...rest}
    />
  );
}

/* ---------- Progress ring ---------- */
export function ProgressRing({ value, size = 96, label }: { value: number; size?: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
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
          strokeDashoffset={c * (1 - clamped / 100)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="absolute font-mono text-lg font-semibold">{Math.round(clamped)}%</span>
    </div>
  );
}

/* ---------- Progress bar ---------- */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-3"
    >
      <div className="h-full rounded-pill bg-accent" style={{ width: `${clamped}%`, transition: "width var(--lv-motion-base) var(--lv-ease)" }} />
    </div>
  );
}

/* ---------- Spinner (theme slot) ---------- */
export function Spinner({ size = 28, inherit = false }: { size?: number; inherit?: boolean }) {
  const { themeId } = useTheme();
  const Loader = slots[themeId].Loader;
  // `inherit` keeps the surrounding text colour (needed on an accent-coloured button).
  return <span className={inherit ? "inline-flex" : "inline-flex text-accent"}>{Loader({ size })}</span>;
}

/* ---------- Empty state (theme slot illustration) ---------- */
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  const { themeId } = useTheme();
  const Art = slots[themeId].EmptyArt;
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <Art />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-muted">{description}</p>
      {action}
    </div>
  );
}

/* ---------- Theme background (theme slot) ---------- */
export function ThemeBackground() {
  const { themeId } = useTheme();
  return <>{slots[themeId].Background()}</>;
}
