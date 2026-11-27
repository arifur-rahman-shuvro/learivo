import type { ReactNode } from "react";
import { cx } from "../cx.ts";
import { ChevronIcon } from "../icons/icons.tsx";

/** A big, tappable entry to one tool: icon, name, one line of help and an optional live count. */
export function Tile({
  icon,
  title,
  help,
  count,
  countLabel,
  soon,
  badge,
  tone = "plain",
  stack,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  help?: string;
  /** A number that needs attention, such as cards due. Hidden when 0 or missing. */
  count?: number;
  /** Words for screen readers, for example "due". */
  countLabel?: string;
  /** Not playable yet: shown dimmed with a Coming soon label and not clickable. */
  soon?: boolean;
  /** A small label such as "Soon" on a tile that still opens. */
  badge?: string;
  tone?: "plain" | "accent";
  /** Icon on top and text below, for two tiles side by side on a phone. */
  stack?: boolean;
  onClick?: () => void;
}) {
  const body = stack ? (
    <>
      <span className="flex w-full items-start justify-between">
        <span
          aria-hidden
          className={cx(
            "grid size-11 place-items-center rounded-control",
            tone === "accent" ? "bg-accent text-on-accent" : "bg-surface-2 text-accent",
          )}
        >
          {icon}
        </span>
        {soon || badge ? (
          <span className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-muted">
            {badge ?? "Soon"}
          </span>
        ) : count ? (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-on-accent">
            {count}
            {countLabel && <span className="sr-only"> {countLabel}</span>}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col text-left">
        <span className="text-base font-semibold leading-snug">{title}</span>
        {help && <span className="text-sm leading-snug text-muted">{help}</span>}
      </span>
    </>
  ) : (
    <>
      <span
        aria-hidden
        className={cx(
          "grid size-12 shrink-0 place-items-center rounded-control",
          tone === "accent" ? "bg-accent text-on-accent" : "bg-surface-2 text-accent",
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-base font-semibold leading-snug">{title}</span>
        {help && <span className="text-sm leading-snug text-muted">{help}</span>}
      </span>
      {soon || badge ? (
        <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted">
          {badge ?? "Coming soon"}
        </span>
      ) : count ? (
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-sm font-bold text-on-accent">
          {count}
          {countLabel && <span className="sr-only"> {countLabel}</span>}
        </span>
      ) : (
        <ChevronIcon size={18} className="shrink-0 text-muted" />
      )}
    </>
  );
  const shared = stack
    ? "lv-card flex min-h-[8rem] w-full flex-col justify-between gap-3 p-3.5 text-left"
    : "lv-card flex min-h-[4.5rem] w-full items-center gap-3 p-3.5 text-left";
  if (soon) {
    return (
      <div aria-disabled="true" className={cx(shared, "opacity-70")}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cx(shared, "lv-card-interactive")}>
      {body}
    </button>
  );
}

/** Tiles in one column on a phone and two columns on a wider screen. */
export function TileGrid({ children, cols = 1 }: { children: ReactNode; cols?: 1 | 2 }) {
  return (
    <div className={cx("grid gap-3", cols === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
      {children}
    </div>
  );
}
