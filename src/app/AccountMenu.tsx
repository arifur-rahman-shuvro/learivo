import { forgetAllKeys } from "../modules/ai/keys.ts";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "../design-system/index.ts";
import { canAnimate, EASE_IN, EASE_OUT, usePresence } from "../design-system/motion.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useOfflineControls } from "../offline/OfflineProvider.tsx";
import { avatarColor, initials } from "../modules/profile/domain/profile.ts";
import type { ProfileRepo } from "../modules/profile/data/repo.ts";
import { openGuide } from "./guide.ts";
import { useProfile } from "../modules/profile/ui/useProfile.ts";
import { AppearanceDialog, ProfileDialog, SettingsDialog } from "./AccountDialogs.tsx";
import DataDialog from "./DataDialog.tsx";

type Panel = "profile" | "appearance" | "settings" | "data" | null;

function Item({
  onClick,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-control px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface-2 focus-visible:bg-surface-2 ${
        danger ? "text-danger" : ""
      }`}
    >
      {children}
    </button>
  );
}

/**
 * One avatar button in the top bar. It opens a menu with the student's profile, appearance,
 * settings and sign out, so the bar stays short on a phone.
 */
export default function AccountMenu({ repo }: { repo: ProfileRepo }) {
  const { user, client } = useAuth();
  const offline = useOfflineControls();
  const { profile, save } = useProfile(repo);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const avatarId = useId();
  const presence = usePresence(open);
  const zoomed = open || panel !== null;
  const email = user?.email ?? "";
  const label = initials(profile.displayName);
  const color = avatarColor(profile.avatar);

  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(
        box.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
      );
      if (items.length === 0) return;
      e.preventDefault();
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // The menu drops out of the avatar and folds back into it.
  useLayoutEffect(() => {
    const el = menu.current;
    if (!el || !canAnimate()) return;
    const hidden = { transform: "translateY(-6px) scale(0.86)", opacity: 0 };
    const shown = { transform: "none", opacity: 1 };
    if (open) el.animate([hidden, shown], { duration: 260, easing: EASE_OUT });
    else if (presence.exiting) {
      const a = el.animate([shown, hidden], { duration: 160, easing: EASE_IN, fill: "forwards" });
      a.onfinish = presence.finish;
      a.oncancel = presence.finish;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presence.exiting]);

  const show = (p: Panel) => {
    setOpen(false);
    setPanel(p);
  };

  async function signOut() {
    setLeaving(true);
    await offline?.pack.clear().catch(() => undefined);
    await offline?.sync.clearCaches().catch(() => undefined);
    forgetAllKeys(); // AI keys belong to this device only
    await client.signOut();
  }

  return (
    <div ref={box} className="relative">
      <button
        ref={trigger}
        id={avatarId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-full p-0.5 outline-offset-2 transition-[transform,box-shadow] duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:opacity-90 ${
          zoomed ? "scale-110 shadow-[0_0_0_2px_var(--lv-accent,currentColor)]" : ""
        }`}
      >
        <Avatar initials={label} color={color} size={36} />
      </button>
      {presence.render && (
        <div
          ref={menu}
          data-origin-from={avatarId}
          role="menu"
          aria-label="Account"
          className={`lv-card lv-card-raised absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] origin-top-right p-2 ${open ? "" : "pointer-events-none"}`}
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar initials={label} color={color} size={44} />
            <div className="min-w-0">
              <p className="m-0 truncate font-semibold">{profile.displayName || "Your account"}</p>
              <p className="m-0 truncate text-sm text-muted">{email}</p>
            </div>
          </div>
          <div role="separator" className="my-1 border-t border-line" />
          <Item onClick={() => show("profile")}>Your profile</Item>
          <Item onClick={() => show("appearance")}>Appearance</Item>
          <Item
            onClick={() => {
              setOpen(false);
              openGuide();
            }}
          >
            User guide
          </Item>
          <Item onClick={() => show("settings")}>Settings</Item>
          <div role="separator" className="my-1 border-t border-line" />
          <Item danger disabled={leaving} onClick={() => void signOut()}>
            {leaving ? "Signing out…" : "Sign out"}
          </Item>
        </div>
      )}
      <ProfileDialog
        open={panel === "profile"}
        email={email}
        profile={profile}
        onSave={save}
        onClose={() => setPanel(null)}
      />
      <AppearanceDialog open={panel === "appearance"} onClose={() => setPanel(null)} />
      <SettingsDialog
        open={panel === "settings"}
        onClose={() => setPanel(null)}
        onOpenData={() => setPanel("data")}
      />
      <DataDialog open={panel === "data"} onClose={() => setPanel(null)} />
    </div>
  );
}
