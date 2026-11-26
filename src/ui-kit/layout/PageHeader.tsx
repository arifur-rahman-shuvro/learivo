import type { ReactNode } from "react";
import { BackIcon } from "../icons/icons.tsx";

/**
 * The same top of every screen: a title (the page's one h1), one line of help, an optional Back
 * button for pages that open from a hub, and room for one main action on the right.
 */
export function PageHeader({
  title,
  help,
  onBack,
  backLabel = "Back",
  action,
}: {
  title: string;
  help?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-control px-2 text-sm font-semibold text-muted hover:text-fg"
        >
          <BackIcon size={18} />
          {backLabel}
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 id="module-title" className="m-0 text-3xl font-bold leading-tight">
            {title}
          </h1>
          {help && <p className="m-0 mt-1 text-sm text-muted">{help}</p>}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
    </header>
  );
}
