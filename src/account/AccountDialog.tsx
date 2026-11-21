import { Button, Dialog } from "../ui-kit/index.ts";
import type { Profile } from "../modules/profile/domain/profile.ts";
import { DetailsSection } from "./sections/DetailsSection.tsx";
import { EmailSection } from "./sections/EmailSection.tsx";
import { PasswordSection } from "./sections/PasswordSection.tsx";
import { DeleteSection } from "./sections/DeleteSection.tsx";

/**
 * Everything about the signed-in account in one place: details, password, deleting the account.
 * To add something account-related later, make a file in `sections/` and list it here.
 */
export function AccountDialog({
  open,
  email,
  profile,
  onSave,
  onClose,
}: {
  open: boolean;
  email: string;
  profile: Profile;
  onSave: (p: Profile) => Promise<unknown>;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      variant="modal"
      title="Account"
      onClose={onClose}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="flex flex-col gap-7">
        <DetailsSection email={email} profile={profile} onSave={onSave} />
        <EmailSection />
        <PasswordSection />
        <DeleteSection />
      </div>
    </Dialog>
  );
}
