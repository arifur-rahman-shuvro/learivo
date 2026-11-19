import { useEffect, useState } from "react";
import { Avatar, Button } from "../../ui-kit/index.ts";
import {
  AVATARS,
  NAME_MAX,
  avatarColor,
  cleanName,
  initials,
  type AvatarId,
  type Profile,
} from "../../modules/profile/domain/profile.ts";
import { errorText } from "../../modules/question-bank/ui/bank.tsx";

export function DetailsSection({
  email,
  profile,
  onSave,
}: {
  email: string;
  profile: Profile;
  onSave: (p: Profile) => Promise<unknown>;
}) {
  const [name, setName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState<AvatarId>(profile.avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  // Show what is stored whenever the stored profile changes.
  useEffect(() => {
    setName(profile.displayName);
    setAvatar(profile.avatar);
    setError(undefined);
    setSaved(false);
  }, [profile]);

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
    <section aria-label="Account details" className="flex flex-col gap-5">
      <h3 className="m-0 text-base font-semibold">Account details</h3>
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
      <div>
        <Button size="sm" loading={busy} disabled={!changed} onClick={() => void save()}>
          Save details
        </Button>
      </div>
    </section>
  );
}
