import { useState, type FormEvent } from "react";
import { Button, Field, LogoWordmark, ThemeBackground } from "../ui-kit/index.ts";
import { useAuth } from "./AuthProvider.tsx";

const MIN_PASSWORD = 8;

/** Shown after the emailed reset link is opened: choose a new password before using the app. */
export default function SetNewPassword() {
  const { client, finishRecovery, user } = useAuth();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = again.length > 0 && again !== password;
  const ready = password.length >= MIN_PASSWORD && again === password;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(undefined);
    const r = await client.setNewPassword(password);
    setBusy(false);
    if (r.ok) finishRecovery();
    else setError(r.message);
  }

  return (
    <>
      <ThemeBackground />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
        <header className="flex items-center justify-between">
          <LogoWordmark />
        </header>
        <main className="lv-card flex flex-col gap-5 p-6 sm:p-8">
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <h1 className="m-0 text-2xl font-bold">Choose a new password</h1>
            {user?.email && (
              <p className="m-0 text-sm text-muted">
                For <strong className="text-fg">{user.email}</strong>
              </p>
            )}
            <Field
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              hint={`At least ${MIN_PASSWORD} characters.`}
              error={tooShort ? `Use at least ${MIN_PASSWORD} characters.` : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Field
              label="Repeat new password"
              type="password"
              autoComplete="new-password"
              value={again}
              error={mismatch ? "The passwords do not match." : undefined}
              onChange={(e) => setAgain(e.target.value)}
            />
            {error && (
              <p role="alert" className="m-0 text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy} disabled={!ready}>
              Save new password
            </Button>
            <Button type="button" variant="secondary" onClick={() => void client.signOut()}>
              Cancel
            </Button>
          </form>
        </main>
      </div>
    </>
  );
}
