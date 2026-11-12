import { useEffect, useRef, useState } from "react";
import { SettingsIcon, ThemeSwitcher } from "../design-system/index.ts";

/** Theme and mode live in a small menu, not on every screen. */
export default function AppearanceMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="lv-btn lv-btn-secondary lv-btn-sm"
      >
        <SettingsIcon />
        Appearance
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Appearance"
          className="lv-card lv-card-raised absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] p-4"
        >
          <ThemeSwitcher />
        </div>
      )}
    </div>
  );
}
