import { useState, type ReactNode } from "react";
import { HomeIcon, InsightsIcon, PracticeIcon, QuestionsIcon, ReviewIcon } from "./icons.tsx";

const items: Array<{ id: string; label: string; icon: ReactNode }> = [
  { id: "home", label: "Home", icon: <HomeIcon /> },
  { id: "questions", label: "Questions", icon: <QuestionsIcon /> },
  { id: "practice", label: "Practice", icon: <PracticeIcon /> },
  { id: "review", label: "Review", icon: <ReviewIcon /> },
  { id: "insights", label: "Insights", icon: <InsightsIcon /> },
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
  const setActive = (id: string) => {
    setLocal(id);
    onSelect?.(id);
  };
  return (
    <nav
      aria-label="Primary"
      className="grid grid-flow-col auto-cols-fr gap-1 rounded-card border border-line bg-surface-1 p-1.5 shadow-[var(--lv-shadow-card)] lg:flex lg:flex-col lg:gap-0.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
    >
      {shown.map((it) => {
        const current = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            aria-current={current ? "page" : undefined}
            onClick={() => setActive(it.id)}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-control text-xs font-semibold lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${
              current ? "bg-accent text-on-accent" : "text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}
