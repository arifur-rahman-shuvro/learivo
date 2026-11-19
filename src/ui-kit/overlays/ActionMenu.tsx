import { useEffect, useId, useRef, useState } from "react";

export interface ActionItem {
  label: string;
  onSelect: () => void;
  /** Shown in the danger colour, for things like delete. */
  danger?: boolean;
}

interface Props {
  /** Describes the button for screen readers, for example "Actions for: What is the…". */
  label: string;
  items: readonly ActionItem[];
}

const WIDTH = 208;

/**
 * A "more" button that opens a small menu of actions. It opens at the button, stays on screen
 * whatever sits around it, and closes on Escape, an outside tap, scrolling or choosing an item.
 */
export function ActionMenu({ label, items }: Props) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = at !== null;

  function toggle() {
    if (open) return setAt(null);
    const r = trigger.current!.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - WIDTH - 8, r.right - WIDTH));
    setAt({ top: r.bottom + 6, left });
  }

  function close(refocus: boolean) {
    setAt(null);
    if (refocus) trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const items = () => [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    ];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close(true);
      if (e.key === "Tab") return close(false);
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const list = items();
      const at = list.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
      list[next]?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    const away = () => close(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={toggle}
        className="grid size-9 shrink-0 place-items-center rounded-control border border-line text-muted hover:bg-surface-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          style={{ position: "fixed", top: at.top, left: at.left, width: WIDTH }}
          className="lv-menu-in lv-card lv-card-raised z-50 flex origin-top-right flex-col p-1.5"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                close(true);
                it.onSelect();
              }}
              className={`min-h-[44px] rounded-control px-3 text-left text-sm font-semibold hover:bg-surface-2 focus-visible:bg-surface-2 ${
                it.danger ? "text-danger" : ""
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
