import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog } from "./Dialog.tsx";
import { CheckIcon, SearchIcon } from "./icons.tsx";

export interface PickerOption {
  value: string;
  label: string;
  /** Nesting level, for subjects and chapters. 0 is a top-level item. */
  depth?: number;
  /** Small text on the right, such as a count. */
  hint?: string;
  /** A line of explanation under the label. */
  description?: string;
}

interface Props {
  /** Shown above the field and as the sheet's title, for example "Subject". */
  label: string;
  value: string;
  options: readonly PickerOption[];
  onChange: (value: string) => void;
  /** Text for the empty choice, for example "All subjects". Leave out when a choice is required. */
  emptyLabel?: string;
  /** Show the search box from this many options. */
  searchFrom?: number;
  /** Shown on the field when the value matches no option, for fields that start unchosen. */
  placeholder?: string;
  /** Hide the text above the field (it still names the field and the sheet). */
  hideLabel?: boolean;
  className?: string;
}

const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * A choice field that opens a roomy sheet instead of the phone's plain radio list: big tap
 * targets, a search box for long lists, nested items shown with a guide line, and a tick on the
 * current choice.
 */
export function Picker({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  searchFrom = 8,
  hideLabel = false,
  placeholder = "Choose",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  // Put the cursor on the current choice and bring it into view when the sheet opens.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      el?.scrollIntoView?.({ block: "center" });
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      items[e.key === "ArrowDown" ? Math.min(i + 1, items.length - 1) : Math.max(i - 1, 0)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const all = useMemo<PickerOption[]>(
    () => (emptyLabel ? [{ value: "", label: emptyLabel }, ...options] : [...options]),
    [emptyLabel, options],
  );
  const current = all.find((o) => o.value === value);
  const searching = query.trim() !== "";
  const shown = searching
    ? all.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : all;

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const choose = (v: string) => {
    onChange(v);
    close();
  };

  return (
    <div className={`flex flex-col gap-1.5 text-sm font-semibold ${className}`}>
      <span className={hideLabel ? "sr-only" : ""}>{label}</span>
      <button
        type="button"
        className="lv-input flex min-h-11 items-center justify-between gap-2 text-left font-normal"
        aria-haspopup="dialog"
        aria-label={`${label}: ${current?.label.trim() ?? "none chosen"}`}
        onClick={() => setOpen(true)}
      >
        <span
          className={`min-w-0 truncate ${!current || (value === "" && emptyLabel) ? "text-muted" : ""}`}
        >
          {current?.label.trim() ?? placeholder}
        </span>
        <span className="shrink-0 text-muted">
          <Chevron />
        </span>
      </button>

      <Dialog open={open} title={label} onClose={close}>
        <div className="flex flex-col gap-3">
          {all.length >= searchFrom && (
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              >
                <SearchIcon size={18} />
              </span>
              <input
                type="search"
                className="lv-input w-full"
                style={{ paddingLeft: 40 }}
                aria-label={`Search ${label.toLowerCase()}`}
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          <ul
            ref={listRef}
            onKeyDown={onListKey}
            id={listId}
            role="listbox"
            aria-label={label}
            className="m-0 flex list-none flex-col gap-1 p-0"
          >
            {shown.map((o) => {
              const selected = o.value === value;
              const depth = searching ? 0 : (o.depth ?? 0);
              return (
                <li
                  key={o.value}
                  role="presentation"
                  className="relative"
                  style={{ paddingLeft: depth * 20 }}
                >
                  {depth > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-0.5 bottom-[-2px] w-0.5 rounded bg-line-strong opacity-60"
                      style={{ left: depth * 20 - 10 }}
                    />
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => choose(o.value)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-control border px-3.5 py-2.5 text-left transition-colors ${
                      selected
                        ? "border-accent bg-surface-2 font-semibold"
                        : "border-transparent hover:bg-surface-2"
                    }`}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className={depth === 0 && o.value !== "" ? "font-semibold" : ""}>
                        {o.label.trim()}
                      </span>
                      {o.description && (
                        <span className="text-xs font-normal text-muted">{o.description}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
                      {o.hint}
                      {selected && (
                        <span className="text-accent">
                          <CheckIcon size={20} title="Selected" />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && (
              <li role="presentation" className="px-3 py-6 text-center text-muted">
                Nothing matches “{query.trim()}”.
              </li>
            )}
          </ul>
        </div>
      </Dialog>
    </div>
  );
}
