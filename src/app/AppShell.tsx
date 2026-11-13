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
import { moduleForHash, visibleModules, type ModuleId } from "./registry.ts";
import { supabase } from "../lib/supabase.ts";
import { SupabaseRepo } from "../modules/question-bank/data/supabaseRepo.ts";
import type { QuestionRepo } from "../modules/question-bank/data/repo.ts";
import { BankProvider } from "../modules/question-bank/ui/bank.tsx";
import { SupabaseAttempts } from "../modules/practice/data/supabaseAttempts.ts";
import type { AttemptRepo } from "../modules/practice/data/repo.ts";
import { PracticeProvider } from "../modules/practice/ui/practice.tsx";
import { SupabaseWorkspace } from "../modules/workspace/data/supabaseWorkspace.ts";
import type { WorkspaceRepo } from "../modules/workspace/data/repo.ts";
import { WorkspaceProvider } from "../modules/workspace/ui/workspace.tsx";
import HomeDashboard from "../modules/workspace/ui/HomeDashboard.tsx";

const PracticeScreen = lazy(() => import("../modules/practice/ui/PracticeScreen.tsx"));
const QuestionsScreen = lazy(() => import("../modules/question-bank/ui/QuestionsScreen.tsx"));
const ReviewScreen = lazy(() => import("../modules/workspace/ui/ReviewScreen.tsx"));
const InsightsScreen = lazy(() => import("../modules/workspace/ui/InsightsScreen.tsx"));

export interface Repos {
  makeRepo?: (userId: string) => QuestionRepo;
  makeAttempts?: (userId: string) => AttemptRepo;
  makeWorkspace?: (userId: string) => WorkspaceRepo;
}

/**
 * Gives every signed-in screen its data: the question bank, practice history and the personal
 * workspace. One host for all of them, so switching screens keeps what is already loaded.
 */
function ModuleHost({
  userId,
  module,
  onNavigate,
  makeRepo,
  makeAttempts,
  makeWorkspace,
}: Repos & { userId: string; module: ModuleId; onNavigate: (route: string) => void }) {
  const repo = useMemo(
    () => (makeRepo ? makeRepo(userId) : new SupabaseRepo(supabase, userId)),
    [userId, makeRepo],
  );
  const attempts = useMemo(
    () => (makeAttempts ? makeAttempts(userId) : new SupabaseAttempts(supabase, userId)),
    [userId, makeAttempts],
  );
  const workspace = useMemo(
    () => (makeWorkspace ? makeWorkspace(userId) : new SupabaseWorkspace(supabase, userId)),
    [userId, makeWorkspace],
  );
  return (
    <BankProvider repo={repo}>
      <PracticeProvider attempts={attempts}>
        <WorkspaceProvider repo={workspace}>
          <Suspense fallback={<div role="status" aria-label="Loading" />}>
            {module === "home" ? (
              <HomeDashboard onNavigate={onNavigate} />
            ) : module === "questions" ? (
              <QuestionsScreen />
            ) : module === "practice" ? (
              <PracticeScreen />
            ) : module === "review" ? (
              <ReviewScreen onNavigate={onNavigate} />
            ) : (
              <InsightsScreen onNavigate={onNavigate} />
            )}
          </Suspense>
        </WorkspaceProvider>
      </PracticeProvider>
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
export default function AppShell({ makeRepo, makeAttempts, makeWorkspace }: Repos = {}) {
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
            {user ? (
              <ModuleHost
                userId={user.id}
                module={current.id}
                onNavigate={go}
                makeRepo={makeRepo}
                makeAttempts={makeAttempts}
                makeWorkspace={makeWorkspace}
              />
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
