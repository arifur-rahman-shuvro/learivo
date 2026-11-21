import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState, ThemeBackground } from "../ui-kit/index.ts";
import { BottomNav } from "./navigation/BottomNav.tsx";
import App from "../App.tsx";
import { useAuth } from "../auth/AuthProvider.tsx";
import SetNewPassword from "../auth/SetNewPassword.tsx";
import AuthScreen from "../auth/AuthScreen.tsx";
import AccountMenu from "../account/AccountMenu.tsx";
import AppFrame from "./AppFrame.tsx";
import ModuleHost from "./ModuleHost.tsx";
import { AiGate } from "./Gates.tsx";
import ToastHost from "./chrome/ToastHost.tsx";
import { SupabaseProfile } from "../modules/profile/data/supabaseProfile.ts";
import type { ProfileRepo } from "../modules/profile/data/repo.ts";
import { useFocusMode } from "../core/focus.ts";
import CommandPalette from "./navigation/CommandPalette.tsx";
import { OfflineProvider } from "../platform/offline/OfflineProvider.tsx";
import { moduleForHash, visibleModules } from "./navigation/registry.ts";
import { supabase } from "../core/supabase.ts";
import { SupabaseRepo } from "../modules/question-bank/data/supabaseRepo.ts";
import type { QuestionRepo } from "../modules/question-bank/data/repo.ts";
import { SupabaseData } from "../modules/data/data/supabaseData.ts";
import { SupabaseAttempts } from "../modules/practice/data/supabaseAttempts.ts";
import type { AttemptRepo } from "../modules/practice/data/repo.ts";
import type { WorkspaceRepo } from "../modules/workspace/data/repo.ts";

export interface Repos {
  makeRepo?: (userId: string) => QuestionRepo;
  makeAttempts?: (userId: string) => AttemptRepo;
  makeWorkspace?: (userId: string) => WorkspaceRepo;
  makeProfile?: (userId: string) => ProfileRepo;
  /** Test seam: stands in for the database, so the real offline layer runs on top of it. */
  makeLive?: (userId: string) => {
    bank: QuestionRepo;
    attempts: AttemptRepo;
  };
}

/** Builds the profile store once per student, so the menu does not reload it on every render. */
function AccountHost({ userId, makeProfile }: Pick<Repos, "makeProfile"> & { userId: string }) {
  const repo = useMemo(
    () => (makeProfile ? makeProfile(userId) : new SupabaseProfile(supabase, userId)),
    [userId, makeProfile],
  );
  return <AccountMenu repo={repo} />;
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
 * App shell: decides what to show (loading, sign in, the app) and connects the services. The
 * layout itself is AppFrame, and the screens are in ModuleHost.
 */
export default function AppShell({
  makeRepo,
  makeAttempts,
  makeWorkspace,
  makeProfile,
  makeLive,
}: Repos = {}) {
  const [hash, go] = useHash();
  const { status, user, recovering } = useAuth();
  const focus = useFocusMode();
  if (hash === LAB_ROUTE) return <App />;
  if (status === "loading") return <div role="status" aria-label="Loading" className="min-h-dvh" />;
  if (status === "signed-in" && recovering) return <SetNewPassword />;
  if (status === "signed-out") return <AuthScreen />;

  const current = moduleForHash(hash);
  const modules = visibleModules();
  const withServices = (node: ReactNode) =>
    user ? (
      <OfflineProvider
        userId={user.id}
        injected={{
          bank: makeRepo?.(user.id),
          attempts: makeAttempts?.(user.id),
        }}
        live={() =>
          makeLive?.(user.id) ?? {
            bank: new SupabaseRepo(supabase, user.id),
            attempts: new SupabaseAttempts(supabase, user.id),
            data: new SupabaseData(supabase, user.id),
          }
        }
      >
        {node}
      </OfflineProvider>
    ) : (
      node
    );
  return withServices(
    <>
      <ThemeBackground />
      <a
        href="#main"
        onClick={(e) => {
          // The page address is the screen name here, so move focus instead of changing it.
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="lv-skip"
      >
        Skip to content
      </a>
      <CommandPalette onNavigate={go} />
      <AiGate />
      <ToastHost />
      <AppFrame
        focus={focus}
        onAdd={() => go("#/questions")}
        nav={
          <BottomNav
            ids={modules.map((m) => m.id)}
            activeId={current.id}
            onSelect={(id) => go(modules.find((m) => m.id === id)?.route ?? "#/home")}
          />
        }
        account={user && <AccountHost userId={user.id} makeProfile={makeProfile} />}
      >
        {user ? (
          <ModuleHost
            userId={user.id}
            module={current.id}
            onNavigate={go}
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
      </AppFrame>
    </>,
  );
}
