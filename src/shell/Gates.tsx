import { lazy, Suspense } from "react";
import { useAiDialogOpen } from "../core/dialogs/ai.ts";
import { useGuideOpen } from "../core/dialogs/guide.ts";
import { useBackupOpen } from "../core/dialogs/backup.ts";

const GuideDialog = lazy(() => import("./GuideDialog.tsx"));
const BackupDialog = lazy(() => import("../account/backup/BackupDialog.tsx"));
const AiConnectionDialog = lazy(() =>
  import("../modules/ai/AiConnectionDialog.tsx").then((m) => ({ default: m.AiConnectionDialog })),
);
/** Downloads each dialog's code only the first time it is opened. */
export function GuideGate({ onNavigate }: { onNavigate: (route: string) => void }) {
  return useGuideOpen() ? (
    <Suspense fallback={null}>
      <GuideDialog onNavigate={onNavigate} />
    </Suspense>
  ) : null;
}
export function BackupGate() {
  return useBackupOpen() ? (
    <Suspense fallback={null}>
      <BackupDialog />
    </Suspense>
  ) : null;
}
export function AiGate() {
  return useAiDialogOpen() ? (
    <Suspense fallback={null}>
      <AiConnectionDialog />
    </Suspense>
  ) : null;
}
