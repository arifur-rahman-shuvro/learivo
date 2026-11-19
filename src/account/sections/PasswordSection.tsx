import { useState } from "react";
import { Button } from "../../ui-kit/index.ts";
import { useAuth } from "../../auth/AuthProvider.tsx";

const MIN_PASSWORD = 8;

export function PasswordSection() {
  const { client } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD;
  const mismatch = again.length > 0 && again !== next;
  const ready = current !== "" && next.length >= MIN_PASSWORD && again === next && next !== current;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(undefined);
    setDone(false);
    const r = await client.changePassword(current, next);
    setBusy(false);
    if (r.ok) {
      setDone(true);
      setCurrent("");
      setNext("");
      setAgain("");
    } else setError(r.message);
  }

  const field = (
    id: string,
    label: string,
    v: string,
    set: (s: string) => void,
    auto: string,
    note?: string,
  ) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="password"
        className="lv-input"
        autoComplete={auto}
        value={v}
        aria-describedby={note ? `${id}-note` : undefined}
        onChange={(e) => {
          set(e.target.value);
          setDone(false);
        }}
      />
      {note && (
        <span
          id={`${id}-note`}
          role={note.startsWith("Use") || note.startsWith("The") ? "alert" : undefined}
          className="text-xs text-muted"
        >
          {note}
        </span>
      )}
    </div>
  );

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-3"
      aria-label="Change password"
    >
      <h3 className="m-0 text-base font-semibold">Change password</h3>
      {field("pw-current", "Current password", current, setCurrent, "current-password")}
      {field(
        "pw-new",
        "New password",
        next,
        setNext,
        "new-password",
        tooShort
          ? `Use at least ${MIN_PASSWORD} characters.`
          : `At least ${MIN_PASSWORD} characters.`,
      )}
      {field(
        "pw-again",
        "New password again",
        again,
        setAgain,
        "new-password",
        mismatch ? "The two new passwords are not the same." : undefined,
      )}
      {next !== "" && next === current && (
        <p className="m-0 text-xs text-muted">
          The new password must be different from the current one.
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="m-0 text-sm font-semibold">
          Password changed.
        </p>
      )}
      <div>
        <Button type="submit" size="sm" loading={busy} disabled={!ready}>
          Change password
        </Button>
      </div>
    </form>
  );
}
