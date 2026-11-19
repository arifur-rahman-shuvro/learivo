import { type HTMLAttributes } from "react";
import { cx } from "../cx.ts";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";
const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg border-line-strong",
  accent: "bg-surface-2 text-accent border-accent",
  success: "bg-surface-2 text-success border-success",
  warning: "bg-surface-2 text-warning border-warning",
  danger: "bg-surface-2 text-danger border-danger",
};

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
      {...rest}
    />
  );
}
