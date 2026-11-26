import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState, ThemeBackground } from "../ui-kit/index.ts";
import { BottomNav } from "./navigation/BottomNav.tsx";
import App from "../App.tsx";
import { useAuth } from "../auth/AuthProvider.tsx";
import SetNewPassword from "../auth/SetNewPassword.tsx";
import AuthScreen from "../auth/AuthScreen.tsx";
import { markReturning, isReturning } from "./returning.ts";
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
import { SupabaseWorkspace } from "../modules/workspace/data/supabaseWorkspace.ts";
import type { WorkspaceRepo } from "../modules/workspace/data/repo.ts";
import { landingFor, parseNotifyHash } from "../modules/notifications/domain/link.ts";
import { markNotificationOpened, markRecentSeen } from "../core/push.ts";
import { sendIntent } from "../core/intents.ts";

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
const SIGN_IN_ROUTE = "#/sign-in";
const CREATE_ROUTE = "#/create-account";
const ABOUT_ROUTE = "#/about";
/** The page that introduces Learivo is code only visitors who are signed out ever need. */
const Landing = lazy(() => import("../landing/Landing.tsx"));

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
  const { status, user, recovering, notice } = useAuth();
  const focus = useFocusMode();
  useEffect(() => {
    if (status !== "signed-in") return;
    markReturning();
    // Leave the sign-in address behind, so the app opens on Home.
    if (hash === SIGN_IN_ROUTE || hash === CREATE_ROUTE) go("");
    // A tapped notification: note it, then open the screen it points to.
    const link = parseNotifyHash(hash);
    if (link) {
      void markNotificationOpened(link.id);
      const to = landingFor(link.go);
      if (to.intent) sendIntent(to.intent);
      go(to.route);
    }
  }, [status, hash, go]);
  // Opening the app by hand also counts as having seen the latest messages.
  useEffect(() => {
    if (status === "signed-in" && !parseNotifyHash(window.location.hash)) void markRecentSeen();
  }, [status]);
  if (hash === LAB_ROUTE) return <App />;
  if (status === "loading") return <div role="status" aria-label="Loading" className="min-h-dvh" />;
  if (status === "signed-in" && recovering) return <SetNewPassword />;
  if (status === "signed-out") {
    // Someone who has used Learivo on this device, or whose session just ended, goes straight to sign-in.
    const direct =
      hash === SIGN_IN_ROUTE || hash === CREATE_ROUTE || notice !== null || isReturning();
    if (!direct) {
      return (
        <Suspense fallback={<div role="status" aria-label="Loading" className="min-h-dvh" />}>
          <Landing onSignIn={() => go(SIGN_IN_ROUTE)} onCreate={() => go(CREATE_ROUTE)} />
        </Suspense>
      );
    }
    return (
      <AuthScreen
        key={hash}
        initialMode={hash === CREATE_ROUTE ? "sign-up" : "sign-in"}
        onBack={() => go(ABOUT_ROUTE)}
      />
    );
  }

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
            workspace: new SupabaseWorkspace(supabase, user.id),
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
            activeId={current.navParent ?? current.id}
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
