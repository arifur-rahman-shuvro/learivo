import { useState, type FormEvent } from "react";
import { Button, Field, LogoWordmark, ThemeBackground } from "../design-system/index.ts";
import AppearanceMenu from "../app/AppearanceMenu.tsx";
import { useAuth } from "./AuthProvider.tsx";

type Mode = "sign-in" | "sign-up";
const MIN_PASSWORD = 8;

export default function AuthScreen() {
  const { client } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();

  const emailError =
    email.length > 0 && !/^\S+@\S+\.\S+$/.test(email) ? "Enter a valid email address." : undefined;
  const passwordError =
    mode === "sign-up" && password.length > 0 && password.length < MIN_PASSWORD
      ? `Use at least ${MIN_PASSWORD} characters.`
      : undefined;
  const ready =
    email.length > 0 && !emailError && password.length >= (mode === "sign-up" ? MIN_PASSWORD : 1);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(undefined);
    if (mode === "sign-up") {
      const r = await client.signUp(email.trim(), password);
      if (!r.ok) setError(r.message);
      else if (r.needsConfirmation) setSentTo(email.trim());
    } else {
      const r = await client.signIn(email.trim(), password);
      if (!r.ok) setError(r.message);
    }
    setBusy(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(undefined);
    setSentTo(undefined);
  }

  return (
    <>
      <ThemeBackground />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
        <header className="flex items-center justify-between">
          <LogoWordmark />
          <AppearanceMenu />
        </header>
        <main className="lv-card flex flex-col gap-5 p-6 sm:p-8">
          {sentTo ? (
            <div role="status" className="flex flex-col gap-3">
              <h1 className="m-0 text-2xl font-bold">Check your email</h1>
              <p className="m-0 text-muted">
                We sent a confirmation link to <strong className="text-fg">{sentTo}</strong>. Open
                it on this device, then sign in.
              </p>
              <Button variant="secondary" onClick={() => switchMode("sign-in")}>
                Go to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
              <h1 className="m-0 text-2xl font-bold">
                {mode === "sign-in" ? "Sign in to Learivo" : "Create your account"}
              </h1>
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                error={emailError}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Field
                label="Password"
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                value={password}
                hint={mode === "sign-up" ? `At least ${MIN_PASSWORD} characters.` : undefined}
                error={passwordError}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && (
                <p role="alert" className="m-0 text-sm font-medium text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" loading={busy} disabled={!ready}>
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </Button>
              <p className="m-0 text-center text-sm text-muted">
                {mode === "sign-in" ? "New to Learivo? " : "Already have an account? "}
                <button
                  type="button"
                  className="font-semibold text-accent underline"
                  onClick={() => switchMode(mode === "sign-in" ? "sign-up" : "sign-in")}
                >
                  {mode === "sign-in" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </form>
          )}
        </main>
      </div>
    </>
  );
}
