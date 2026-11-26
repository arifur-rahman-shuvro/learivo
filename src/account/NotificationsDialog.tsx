import { Button, Dialog } from "../ui-kit/index.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { NotificationsPanel } from "../modules/notifications/ui/NotificationsPanel.tsx";

export function NotificationsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  return (
    <Dialog
      open={open}
      variant="modal"
      title="Notifications"
      onClose={onClose}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {user ? <NotificationsPanel userId={user.id} /> : null}
    </Dialog>
  );
}
