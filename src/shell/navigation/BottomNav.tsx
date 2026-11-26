import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  HomeIcon,
  InsightsIcon,
  PracticeIcon,
  QuestionsIcon,
  ReviewIcon,
} from "../../ui-kit/icons/icons.tsx";

const items: Array<{ id: string; label: string; icon: ReactNode }> = [
  { id: "home", label: "Home", icon: <HomeIcon /> },
  { id: "questions", label: "Questions", icon: <QuestionsIcon /> },
  { id: "practice", label: "Practice", icon: <PracticeIcon /> },
  { id: "review", label: "Review", icon: <ReviewIcon /> },
  { id: "insights", label: "Progress", icon: <InsightsIcon /> },
];

/**
 * Primary navigation: the same five destinations on every device.
 * Bottom tab bar on phones; becomes a vertical sidebar list from the `lg` breakpoint
 * when the parent gives it room (the shell places it inside the sidebar).
 */
export function BottomNav({
  activeId,
  onSelect,
  ids,
}: {
  /** Controlled mode: the shell owns the active module. Omit for a self-contained demo. */
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Which destinations to show, in order. Defaults to all five. */
  ids?: readonly string[];
} = {}) {
  const [local, setLocal] = useState("home");
  const active = activeId ?? local;
  const shown = ids ? items.filter((it) => ids.includes(it.id)) : items;
  const nav = useRef<HTMLElement>(null);
  const [slot, setSlot] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // A highlight slides to the current tab instead of each tab lighting up on its own.
  useLayoutEffect(() => {
    const measure = () => {
      const el = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!el || el.offsetWidth === 0) return setSlot(null);
      setSlot({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, shown.length]);
  const setActive = (id: string) => {
    setLocal(id);
    onSelect?.(id);
  };
  return (
    <nav
      ref={nav}
      aria-label="Primary"
      className="relative grid grid-flow-col auto-cols-fr gap-1 rounded-card border border-line bg-surface-1 p-1.5 shadow-[var(--lv-shadow-card)] lg:flex lg:flex-col lg:gap-0.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
    >
      {slot && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-control bg-accent lv-t-slide transition-transform"
          style={{
            width: slot.w,
            height: slot.h,
            transform: `translate(${slot.x}px, ${slot.y}px)`,
          }}
        />
      )}
      {shown.map((it) => {
        const current = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            aria-current={current ? "page" : undefined}
            onClick={() => setActive(it.id)}
            className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-control text-xs font-semibold lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${
              current
                ? `text-on-accent ${slot ? "" : "bg-accent"}`
                : "text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            <span key={current ? "on" : "off"} className={current ? "lv-pop" : ""}>
              {it.icon}
            </span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}
