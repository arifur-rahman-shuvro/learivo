import { type HTMLAttributes } from "react";
import { cx } from "../cx.ts";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  interactive?: boolean;
}

export function Card({ raised, interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "lv-card",
        raised && "lv-card-raised",
        interactive && "lv-card-interactive",
        className,
      )}
      {...rest}
    />
  );
}
