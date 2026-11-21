import { useState } from "react";
import { Button } from "../../ui-kit/index.ts";
import { useAuth } from "../../auth/AuthProvider.tsx";

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Changing the sign-in email. Needs the password, and the address only changes once the emailed links are opened. */
export function EmailSection() {
  const { client, user } = useAuth();
  const [next, setNext] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();

  // The email of a Google account belongs to Google, so there is nothing to change here.
  if (user?.hasPassword === false) {
    return (
      <section aria-label="Email" className="flex flex-col gap-2">
        <h3 className="m-0 text-base font-semibold">Email</h3>
        <p className="m-0 text-sm text-muted">
          You sign in with Google, so your email ({user.email}) is managed by Google.
        </p>
      </section>
    );
  }

  const value = next.trim();
  const invalid = value !== "" && !LOOKS_LIKE_EMAIL.test(value);
  const same = value !== "" && value.toLowerCase() === (user?.email ?? "").toLowerCase();
  const ready = LOOKS_LIKE_EMAIL.test(value) && !same && password !== "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(undefined);
    setSentTo(undefined);
    const r = await client.changeEmail(password, value);
    setBusy(false);
    if (r.ok) {
      setSentTo(value);
      setNext("");
      setPassword("");
    } else setError(r.message);
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-3"
      aria-label="Change email"
    >
      <h3 className="m-0 text-base font-semibold">Change email</h3>
      <p className="m-0 text-sm text-muted">
        Your sign-in email is {user?.email}. You keep signing in with it until you confirm the new
        one.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="em-new" className="text-sm font-semibold">
          New email address
        </label>
        <input
          id="em-new"
          type="email"
          className="lv-input"
          autoComplete="email"
          value={next}
          aria-describedby="em-new-note"
          onChange={(e) => {
            setNext(e.target.value);
            setSentTo(undefined);
          }}
        />
        {(invalid || same) && (
          <span id="em-new-note" role="alert" className="text-xs text-muted">
            {same ? "That is already your email." : "Enter a valid email address."}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="em-pw" className="text-sm font-semibold">
          Your password
        </label>
        <input
          id="em-pw"
          type="password"
          className="lv-input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
      {sentTo && (
        <p role="status" className="m-0 text-sm font-semibold">
          We sent a confirmation link to {sentTo}. Open it to finish. If your account asks for it,
          also confirm from the link sent to your current email.
        </p>
      )}
      <div>
        <Button type="submit" size="sm" loading={busy} disabled={!ready}>
          Send confirmation
        </Button>
      </div>
    </form>
  );
}
