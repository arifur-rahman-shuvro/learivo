import { Spinner } from "../feedback/Spinner.tsx";
import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx.ts";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
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
