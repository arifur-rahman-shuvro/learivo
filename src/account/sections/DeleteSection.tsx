import { useState } from "react";
import { Button, Dialog } from "../../ui-kit/index.ts";
import { useAuth } from "../../auth/AuthProvider.tsx";
import { useClearDeviceData } from "../clearDeviceData.ts";

/** Permanent account deletion. Needs the password and the word DELETE, so it cannot happen by accident. */
export function DeleteSection() {
  const { client } = useAuth();
  const clearDevice = useClearDeviceData();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const close = () => {
    setOpen(false);
    setPassword("");
    setTyped("");
    setError(undefined);
  };

  async function remove() {
    setBusy(true);
    setError(undefined);
    const r = await client.deleteAccount(password);
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
      return;
    }
    await clearDevice();
    // The account is gone and the session has ended; the app moves to the sign-in screen.
  }

  return (
    <section aria-label="Delete account" className="flex flex-col gap-2">
      <h3 className="m-0 text-base font-semibold text-danger">Delete account</h3>
      <p className="m-0 text-sm text-muted">
        Permanently deletes your account with all your questions, practice history, notes and
        flashcards. Download a backup first if you may want them later. This cannot be undone.
      </p>
      <div>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>
      <Dialog
        open={open}
        variant="modal"
        title="Delete your account?"
        onClose={close}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={typed !== "DELETE" || password === ""}
              onClick={() => void remove()}
            >
              Delete my account
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0">
            Everything in this account is removed from our servers for good. This device's offline
            copy is cleared too.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Your password
            <input
              type="password"
              className="lv-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Type DELETE to confirm
            <input className="lv-input" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
          {error && (
            <p role="alert" className="m-0 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </Dialog>
    </section>
  );
}
