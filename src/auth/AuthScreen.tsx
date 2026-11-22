import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, LogoWordmark, ThemeBackground } from "../ui-kit/index.ts";
import AppearanceMenu from "../ui-kit/themes/AppearanceMenu.tsx";
import { useAuth } from "./AuthProvider.tsx";

type Mode = "sign-in" | "sign-up" | "forgot";
const MIN_PASSWORD = 8;

export default function AuthScreen() {
  const { client, notice } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [resetSentTo, setResetSentTo] = useState<string>();
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    let alive = true;
    void client.googleAvailable().then(
      (on) => alive && setGoogle(on),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [client]);

  async function withGoogle() {
    setBusy(true);
    setError(undefined);
    const r = await client.signInWithGoogle();
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
    }
    // On success the browser is on its way to Google.
  }

  const emailError =
    email.length > 0 && !/^\S+@\S+\.\S+$/.test(email) ? "Enter a valid email address." : undefined;
  const passwordError =
    mode === "sign-up" && password.length > 0 && password.length < MIN_PASSWORD
      ? `Use at least ${MIN_PASSWORD} characters.`
      : undefined;
  const ready =
    email.length > 0 &&
    !emailError &&
    (mode === "forgot" || password.length >= (mode === "sign-up" ? MIN_PASSWORD : 1));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(undefined);
    if (mode === "forgot") {
      const r = await client.requestPasswordReset(email.trim());
      if (!r.ok) setError(r.message);
      else setResetSentTo(email.trim());
    } else if (mode === "sign-up") {
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
    setResetSentTo(undefined);
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
          {notice && (
            <p role="status" className="m-0 rounded-control border border-line p-3 text-sm">
              {notice}
            </p>
          )}
          {resetSentTo ? (
            <div role="status" className="flex flex-col gap-3">
              <h1 className="m-0 text-2xl font-bold">Check your email</h1>
              <p className="m-0 text-muted">
                If <strong className="text-fg">{resetSentTo}</strong> has an account, we sent a link
                to choose a new password. Open it on this device. It may take a few minutes, and
                check your spam folder.
              </p>
              <Button variant="secondary" onClick={() => switchMode("sign-in")}>
                Back to sign in
              </Button>
            </div>
          ) : sentTo ? (
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
                {mode === "sign-in"
                  ? "Sign in to Learivo"
                  : mode === "forgot"
                    ? "Reset your password"
                    : "Create your account"}
              </h1>
              {mode === "forgot" && (
                <p className="m-0 text-sm text-muted">
                  Enter your email and we will send a link to choose a new password.
                </p>
              )}
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                error={emailError}
                onChange={(e) => setEmail(e.target.value)}
              />
              {mode !== "forgot" && (
                <Field
                  label="Password"
                  type="password"
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  value={password}
                  hint={mode === "sign-up" ? `At least ${MIN_PASSWORD} characters.` : undefined}
                  error={passwordError}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
              {mode === "sign-in" && (
                <button
                  type="button"
                  className="-mt-2 inline-flex min-h-10 items-center self-start px-1 text-sm font-semibold text-accent underline"
                  onClick={() => switchMode("forgot")}
                >
                  Forgot password?
                </button>
              )}
              {error && (
                <p role="alert" className="m-0 text-sm font-medium text-danger">
                  {error}
                </p>
              )}
              {google && mode !== "forgot" && (
                <>
                  <p aria-hidden className="m-0 text-center text-xs text-muted">
                    or
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    disabled={busy}
                    onClick={() => void withGoogle()}
                  >
                    <GoogleMark />
                    Continue with Google
                  </Button>
                </>
              )}
              <Button type="submit" size="lg" loading={busy} disabled={!ready}>
                {mode === "sign-in"
                  ? "Sign in"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Create account"}
              </Button>
              <p className="m-0 text-center text-sm text-muted">
                {mode === "sign-in" ? "New to Learivo? " : "Already have an account? "}
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center px-1 font-semibold text-accent underline"
                  onClick={() => switchMode(mode === "sign-in" ? "sign-up" : "sign-in")}
                >
                  {mode === "sign-in" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </form>
          )}
        </main>
        <nav aria-label="Legal" className="mt-2 flex justify-center gap-4 text-sm">
          <a
            className="inline-flex min-h-10 items-center px-1 text-muted underline"
            href="/privacy.html"
          >
            Privacy
          </a>
          <a
            className="inline-flex min-h-10 items-center px-1 text-muted underline"
            href="/terms.html"
          >
            Terms
          </a>
        </nav>
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" width="18" height="18" className="shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
