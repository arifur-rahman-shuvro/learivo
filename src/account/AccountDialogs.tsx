import { openAiConnection } from "../core/dialogs/ai.ts";
import { openBackup } from "../core/dialogs/backup.ts";
import { Button, Dialog, ThemeSwitcher } from "../ui-kit/index.ts";
import { SUPPORT_EMAIL, supportMailto } from "../core/support.ts";
import { useDataRepo } from "../platform/offline/OfflineProvider.tsx";

export function AppearanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      variant="modal"
      title="Appearance"
      onClose={onClose}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <ThemeSwitcher />
    </Dialog>
  );
}

export function SettingsDialog({
  open,
  onClose,
  onOpenData,
  onOpenAccount,
}: {
  open: boolean;
  onClose: () => void;
  onOpenData: () => void;
  onOpenAccount: () => void;
}) {
  const hasData = useDataRepo() !== null;
  return (
    <Dialog
      open={open}
      variant="modal"
      title="Settings"
      onClose={onClose}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-semibold">Account</h3>
          <p className="m-0 text-sm text-muted">
            Your name and avatar, your password, and deleting your account.
          </p>
          <div>
            <Button variant="secondary" size="sm" onClick={onOpenAccount}>
              Account
            </Button>
          </div>
        </section>
        {hasData && (
          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-base font-semibold">Your data</h3>
            <p className="m-0 text-sm text-muted">
              See how much you have stored, and clear practice history or questions.
            </p>
            <div>
              <Button variant="secondary" size="sm" onClick={onOpenData}>
                Manage your data
              </Button>
            </div>
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-semibold">AI connection</h3>
          <p className="m-0 text-sm text-muted">
            Connect your own AI account so Learivo can write questions for you.
          </p>
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                openAiConnection();
              }}
            >
              AI connection
            </Button>
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-semibold">Back up and restore</h3>
          <p className="m-0 text-sm text-muted">
            Save your questions, notes, flashcards and more in one file, or restore from one.
          </p>
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                openBackup();
              }}
            >
              Back up and restore
            </Button>
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-semibold">Help and feedback</h3>
          <p className="m-0 text-sm text-muted">
            Something broken, or an idea? Write to {SUPPORT_EMAIL}. The email opens with technical
            details filled in, never your questions or password.
          </p>
          <div className="flex flex-wrap gap-2">
            <a className="lv-btn lv-btn-secondary lv-btn-sm" href={supportMailto("problem")}>
              Report a problem
            </a>
            <a className="lv-btn lv-btn-secondary lv-btn-sm" href={supportMailto("feedback")}>
              Send feedback
            </a>
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-semibold">Shortcuts</h3>
          <p className="m-0 text-sm text-muted">
            Press Ctrl K (or Cmd K) anywhere to search questions and jump to any screen. On a phone,
            tap Search at the top.
          </p>
        </section>
      </div>
    </Dialog>
  );
}
