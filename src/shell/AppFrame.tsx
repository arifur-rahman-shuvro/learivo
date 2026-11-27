import type { ReactNode } from "react";
import { Button, LogoWordmark, PlusIcon, SearchIcon } from "../ui-kit/index.ts";
import StatusBanner from "./chrome/StatusBanner.tsx";
import SyncIndicator from "./chrome/SyncIndicator.tsx";

interface Props {
  /** The five-tab navigation. It sits in the sidebar on desktop and the bottom bar on phones. */
  nav: ReactNode;
  /** Pressing "Add question" in the sidebar. */
  onAdd: () => void;
  /** The avatar menu, or nothing when signed out. */
  account?: ReactNode;
  /** Focus mode hides the bars on phones so a test has the whole screen. */
  focus: boolean;
  /** The current screen. */
  children: ReactNode;
}

/**
 * The skeleton of the app and nothing else: sidebar, bottom bar, top bar and the main area.
 * To change the layout (sizes, positions, what sits where), edit this file. It has no data
 * or routing in it, so it is safe to rework on its own.
 */
export default function AppFrame({ nav, onAdd, account, focus, children }: Props) {
  const hideOnPhoneInFocus = focus ? "max-lg:hidden" : "";
  return (
    <div className="relative z-10 mx-auto min-h-dvh max-w-[1280px] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:border-r lg:border-line lg:px-4 lg:py-6">
        <div className="hidden px-3 lg:block">
          <LogoWordmark />
        </div>
        <div className="hidden lg:block">
          <Button icon={<PlusIcon />} className="w-full" onClick={onAdd}>
            Add question
          </Button>
        </div>
        <div className={`fixed inset-x-0 bottom-0 z-20 p-3 lg:static lg:p-0 ${hideOnPhoneInFocus}`}>
          {nav}
        </div>
      </aside>

      <div
        className={`flex min-w-0 flex-col gap-5 px-4 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-5 ${focus ? "pb-6" : "pb-28"}`}
      >
        <header className={`flex items-center justify-between ${hideOnPhoneInFocus}`}>
          <div className="lg:hidden">
            <LogoWordmark />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="lv-btn lv-btn-secondary lv-btn-sm"
              aria-label="Search and commands"
              onClick={() => window.dispatchEvent(new Event("learivo:palette"))}
            >
              <SearchIcon />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-line px-1 text-xs text-muted lg:inline">
                Ctrl K
              </kbd>
            </button>
            <SyncIndicator />
            {account}
          </div>
        </header>
        <StatusBanner />
        <main id="main" tabIndex={-1} aria-labelledby="module-title" className="outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
