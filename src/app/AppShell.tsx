import { useEffect, useState } from "react";
import {
  BottomNav,
  EmptyState,
  LogoWordmark,
  ThemeBackground,
  ThemeSwitcher,
} from "../design-system/index.ts";
import App from "../App.tsx";
import { moduleForHash, visibleModules } from "./registry.ts";

const LAB_ROUTE = "#/lab";

function useHash(): [string, (hash: string) => void] {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return [hash, (next) => (window.location.hash = next)];
}

/** App shell: navigation is built from the module registry; each module is a placeholder until its phase. */
export default function AppShell() {
  const [hash, go] = useHash();
  if (hash === LAB_ROUTE) return <App />;

  const current = moduleForHash(hash);
  const modules = visibleModules();
  return (
    <>
      <ThemeBackground />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-4 pb-28 pt-5 sm:px-6">
        <header className="flex items-center justify-between">
          <LogoWordmark />
          <ThemeSwitcher />
        </header>
        <main aria-labelledby="module-title" className="lv-card flex-1">
          <h1 id="module-title" className="px-6 pt-6 text-2xl font-bold">
            {current.label}
          </h1>
          <EmptyState
            title={`${current.label} is coming soon`}
            description={`This screen is built in Phase ${current.builtInPhase} of the roadmap.`}
          />
        </main>
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-3xl p-3">
          <BottomNav
            ids={modules.map((m) => m.id)}
            activeId={current.id}
            onSelect={(id) => go(modules.find((m) => m.id === id)?.route ?? "#/home")}
          />
        </div>
      </div>
    </>
  );
}
