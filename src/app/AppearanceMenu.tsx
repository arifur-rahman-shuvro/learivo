import { useEffect, useRef, useState } from "react";
import { Button, SettingsIcon, ThemeSwitcher } from "../design-system/index.ts";
import { useDataRepo } from "../offline/OfflineProvider.tsx";
import DataDialog from "./DataDialog.tsx";

/** Theme, mode and the clear-data tools live in one small menu, not on every screen. */
export default function AppearanceMenu() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(false);
  const hasData = useDataRepo() !== null;
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
        Settings
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Settings"
          className="lv-card lv-card-raised absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] p-4"
        >
          <ThemeSwitcher />
          {hasData && (
            <div className="mt-4 border-t border-line pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setData(true);
                }}
              >
                Your data
              </Button>
            </div>
          )}
        </div>
      )}
      <DataDialog open={data} onClose={() => setData(false)} />
    </div>
  );
}
