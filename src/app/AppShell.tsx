import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  BottomNav,
  Button,
  EmptyState,
  LogoWordmark,
  PlusIcon,
  ThemeBackground,
} from "../design-system/index.ts";
import App from "../App.tsx";
import { useAuth } from "../auth/AuthProvider.tsx";
import AuthScreen from "../auth/AuthScreen.tsx";
import AppearanceMenu from "./AppearanceMenu.tsx";
import Home from "./screens/Home.tsx";
import { moduleForHash, visibleModules } from "./registry.ts";
import { supabase } from "../lib/supabase.ts";
import { SupabaseRepo } from "../modules/question-bank/data/supabaseRepo.ts";
import type { QuestionRepo } from "../modules/question-bank/data/repo.ts";
import { BankProvider } from "../modules/question-bank/ui/bank.tsx";

const QuestionsScreen = lazy(() => import("../modules/question-bank/ui/QuestionsScreen.tsx"));

function QuestionsHost({
  userId,
  makeRepo,
}: {
  userId: string;
  makeRepo?: (userId: string) => QuestionRepo;
}) {
  const repo = useMemo(
    () => (makeRepo ? makeRepo(userId) : new SupabaseRepo(supabase, userId)),
    [userId, makeRepo],
  );
  return (
    <BankProvider repo={repo}>
      <Suspense fallback={<div role="status" aria-label="Loading" />}>
        <QuestionsScreen />
      </Suspense>
    </BankProvider>
  );
}

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

/**
 * App shell. Phones: top bar, content, bottom tab bar. Desktop: left sidebar plus content.
 * Navigation is built from the module registry; modules without a screen show a status panel.
 */
export default function AppShell({
  makeRepo,
}: { makeRepo?: (userId: string) => QuestionRepo } = {}) {
  const [hash, go] = useHash();
  const { status, user, client } = useAuth();
  if (hash === LAB_ROUTE) return <App />;
  if (status === "loading") return <div role="status" aria-label="Loading" className="min-h-dvh" />;
  if (status === "signed-out") return <AuthScreen />;

  const current = moduleForHash(hash);
  const modules = visibleModules();
  return (
    <>
      <ThemeBackground />
      <div className="relative z-10 mx-auto min-h-dvh max-w-[1280px] lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:border-r lg:border-line lg:px-4 lg:py-6">
          <div className="hidden px-3 lg:block">
            <LogoWordmark />
          </div>
          <div className="hidden lg:block">
            <Button icon={<PlusIcon />} className="w-full" onClick={() => go("#/questions")}>
              Add question
            </Button>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-20 p-3 lg:static lg:p-0">
            <BottomNav
              ids={modules.map((m) => m.id)}
              activeId={current.id}
              onSelect={(id) => go(modules.find((m) => m.id === id)?.route ?? "#/home")}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-5">
          <header className="flex items-center justify-between">
            <div className="lg:hidden">
              <LogoWordmark />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden max-w-[16rem] truncate text-sm text-muted sm:inline">
                {user?.email}
              </span>
              <AppearanceMenu />
              <Button variant="ghost" size="sm" onClick={() => void client.signOut()}>
                Sign out
              </Button>
            </div>
          </header>
          <main aria-labelledby="module-title">
            {current.id === "home" ? (
              <Home onNavigate={go} />
            ) : current.id === "questions" && user ? (
              <QuestionsHost userId={user.id} makeRepo={makeRepo} />
            ) : (
              <div className="lv-card p-5 sm:p-7">
                <h1 id="module-title" className="m-0 text-3xl font-bold">
                  {current.label}
                </h1>
                <EmptyState
                  title={`${current.label} is being built`}
                  description={`This screen arrives in Phase ${current.builtInPhase} of the roadmap.`}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
