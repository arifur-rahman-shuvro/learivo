import { useEffect, useState } from "react";
import { openBackup } from "./backupStore.ts";
import { Avatar, Button, Dialog, ThemeSwitcher } from "../design-system/index.ts";
import {
  AVATARS,
  NAME_MAX,
  avatarColor,
  cleanName,
  initials,
  type AvatarId,
  type Profile,
} from "../modules/profile/domain/profile.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useDataRepo } from "../offline/OfflineProvider.tsx";
import { errorText } from "../modules/question-bank/ui/bank.tsx";

export function ProfileDialog({
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
  const [name, setName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState<AvatarId>(profile.avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile.displayName);
      setAvatar(profile.avatar);
      setError(undefined);
      setSaved(false);
    }
  }, [open, profile]);

  const changed = cleanName(name) !== profile.displayName || avatar !== profile.avatar;

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await onSave({ displayName: name, avatar });
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  }

  return (
    <Dialog
      open={open}
      variant="modal"
      title="Your profile"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button loading={busy} disabled={!changed} onClick={() => void save()}>
            Save profile
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar initials={initials(name)} color={avatarColor(avatar)} size={64} />
          <div className="min-w-0">
            <p className="m-0 truncate text-lg font-semibold">{cleanName(name) || "No name yet"}</p>
            <p className="m-0 truncate text-sm text-muted">{email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="profile-name" className="text-sm font-semibold">
            Your name
          </label>
          <input
            id="profile-name"
            className="lv-input"
            value={name}
            maxLength={NAME_MAX + 20}
            autoComplete="name"
            placeholder="How should Learivo call you?"
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
          />
          <span className="text-xs text-muted">
            Only you see this. Up to {NAME_MAX} characters.
          </span>
        </div>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold">Avatar colour</legend>
          <div role="radiogroup" aria-label="Avatar colour" className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={avatar === a.id}
                aria-label={a.label}
                onClick={() => {
                  setAvatar(a.id);
                  setSaved(false);
                }}
                className={`rounded-full p-0.5 ${avatar === a.id ? "ring-2 ring-[var(--lv-accent)] ring-offset-2" : ""}`}
              >
                <Avatar initials={initials(name)} color={a.color} size={36} />
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <p className="m-0 text-sm font-semibold">Email</p>
          <p className="m-0 text-sm text-muted">{email}</p>
          <p className="m-0 text-xs text-muted">
            The email you sign in with cannot be changed here.
          </p>
        </div>

        {error && (
          <p role="alert" className="m-0 text-sm text-danger">
            {error}
          </p>
        )}
        {saved && !error && (
          <p role="status" className="m-0 text-sm font-semibold">
            Profile saved.
          </p>
        )}
      </div>
    </Dialog>
  );
}

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

const MIN_PASSWORD = 8;

function ChangePassword() {
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

export function SettingsDialog({
  open,
  onClose,
  onOpenData,
}: {
  open: boolean;
  onClose: () => void;
  onOpenData: () => void;
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
        <ChangePassword />
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
