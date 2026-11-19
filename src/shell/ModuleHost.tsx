import { lazy, Suspense, useMemo } from "react";
import { BackupGate, GuideGate } from "./Gates.tsx";
import { PanelSkeleton } from "../ui-kit/index.ts";
import { useServices } from "../platform/offline/OfflineProvider.tsx";
import type { ModuleId } from "./navigation/registry.ts";
import { supabase } from "../core/supabase.ts";
import { BankProvider } from "../modules/question-bank/ui/bank.tsx";
import { PracticeProvider } from "../modules/practice/ui/practice.tsx";
import { SupabaseWorkspace } from "../modules/workspace/data/supabaseWorkspace.ts";
import type { WorkspaceRepo } from "../modules/workspace/data/repo.ts";
import { WorkspaceProvider } from "../modules/workspace/ui/workspace.tsx";
import HomeDashboard from "../modules/workspace/ui/HomeDashboard.tsx";

const PracticeScreen = lazy(() => import("../modules/practice/ui/PracticeScreen.tsx"));
const QuestionsScreen = lazy(() => import("../modules/question-bank/ui/QuestionsScreen.tsx"));
const ReviewScreen = lazy(() => import("../modules/workspace/ui/ReviewScreen.tsx"));
const InsightsScreen = lazy(() => import("../modules/workspace/ui/InsightsScreen.tsx"));

/**
 * Gives every signed-in screen its data: the question bank, practice history and the personal
 * workspace. One host for all of them, so switching screens keeps what is already loaded.
 */
export default function ModuleHost({
  userId,
  module,
  onNavigate,
  makeWorkspace,
}: {
  makeWorkspace?: (userId: string) => WorkspaceRepo;
  userId: string;
  module: ModuleId;
  onNavigate: (route: string) => void;
}) {
  const { bank: repo, attempts } = useServices();
  const workspace = useMemo(
    () => (makeWorkspace ? makeWorkspace(userId) : new SupabaseWorkspace(supabase, userId)),
    [userId, makeWorkspace],
  );
  return (
    <BankProvider repo={repo}>
      <PracticeProvider attempts={attempts}>
        <WorkspaceProvider repo={workspace}>
          <Suspense fallback={<PanelSkeleton />}>
            <GuideGate onNavigate={onNavigate} />
            <BackupGate />
            <div key={module} className="lv-fade-in">
              {module === "home" ? (
                <HomeDashboard onNavigate={onNavigate} />
              ) : module === "questions" ? (
                <QuestionsScreen onNavigate={onNavigate} />
              ) : module === "practice" ? (
                <PracticeScreen />
              ) : module === "review" ? (
                <ReviewScreen onNavigate={onNavigate} />
              ) : (
                <InsightsScreen onNavigate={onNavigate} />
              )}
            </div>
          </Suspense>
        </WorkspaceProvider>
      </PracticeProvider>
    </BankProvider>
  );
}
