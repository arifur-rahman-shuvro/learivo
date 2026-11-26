import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, Button, Dialog } from "../ui-kit/index.ts";
import { canAnimate, MOTION, usePresence } from "../motion/index.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { avatarColor, initials } from "../modules/profile/domain/profile.ts";
import type { ProfileRepo } from "../modules/profile/data/repo.ts";
import { openGuide } from "../core/dialogs/guide.ts";
import { useProfile } from "../modules/profile/ui/useProfile.ts";
import { AppearanceDialog, SettingsDialog } from "./AccountDialogs.tsx";
import { NotificationsDialog } from "./NotificationsDialog.tsx";
import { AccountDialog } from "./AccountDialog.tsx";
import { useClearDeviceData } from "./clearDeviceData.ts";
import { saveTextFile } from "../core/saveFile.ts";
import { useOfflineControls } from "../platform/offline/OfflineProvider.tsx";
import { UnsentChangesError } from "../platform/offline/pack.ts";
import DataDialog from "./DataDialog.tsx";

type Panel = "account" | "appearance" | "settings" | "data" | "notifications" | null;

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
  const clearDevice = useClearDeviceData();
  const offline = useOfflineControls();
  const [unsent, setUnsent] = useState<string[] | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
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
    if (open) el.animate([hidden, shown], { duration: MOTION.ms.menuIn, easing: MOTION.ease.out });
    else if (presence.exiting) {
      const a = el.animate([shown, hidden], {
        duration: MOTION.ms.menuOut,
        easing: MOTION.ease.in,
        fill: "forwards",
      });
      a.onfinish = presence.finish;
      a.oncancel = presence.finish;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presence.exiting]);

  const show = (p: Panel) => {
    setOpen(false);
    setPanel(p);
  };

  async function signOut(discardUnsent = false) {
    setLeaving(true);
    try {
      await clearDevice({ discardUnsent });
    } catch (e) {
      if (!(e instanceof UnsentChangesError)) throw e;
      // Changes made offline have not reached the account. Let the student decide.
      setLeaving(false);
      setOpen(false);
      setExportNote(null);
      setUnsent(e.summaries);
      return;
    }
    await client.signOut();
  }

  async function keepUnsent() {
    const text = await offline?.pack.exportPending();
    if (!text) return;
    saveTextFile(`learivo-unsent-${new Date().toISOString().slice(0, 10)}.json`, text);
    setExportNote("Saved. Import this file later from Add questions to get them back.");
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
        className={`rounded-full p-0.5 outline-offset-2 lv-t-spring transition-[transform,box-shadow] hover:opacity-90 ${
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
          <Item onClick={() => show("account")}>Account</Item>
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
      <AccountDialog
        open={panel === "account"}
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
        onOpenAccount={() => setPanel("account")}
        onOpenNotifications={() => setPanel("notifications")}
      />
      <NotificationsDialog open={panel === "notifications"} onClose={() => setPanel(null)} />
      <DataDialog open={panel === "data"} onClose={() => setPanel(null)} />
      <Dialog
        open={unsent !== null}
        variant="modal"
        title="Changes not sent yet"
        onClose={() => setUnsent(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnsent(null)}>
              Stay signed in
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setUnsent(null);
                void signOut(true);
              }}
            >
              Sign out and discard
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="m-0">
            You made {unsent?.length ?? 0} change{unsent?.length === 1 ? "" : "s"} without a
            connection and they have not reached your account. Signing out now would lose them.
            Connect to the internet and stay signed in to send them, or save them as a file first.
          </p>
          <ul className="m-0 pl-5">
            {(unsent ?? []).slice(0, 8).map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
          {(unsent?.length ?? 0) > 8 && <p className="m-0 text-muted">and more.</p>}
          <div>
            <Button size="sm" variant="secondary" onClick={() => void keepUnsent()}>
              Save changes as a file
            </Button>
          </div>
          {exportNote && (
            <p role="status" className="m-0 font-medium">
              {exportNote}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
