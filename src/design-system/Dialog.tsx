import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  playEnter,
  playExit,
  recentOrigin,
  usePresence,
  type EnterKind,
  type Origin,
} from "./motion.ts";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** "drawer": bottom sheet on phones, right-hand panel on desktop. "modal": centred on desktop. */
  variant?: "drawer" | "modal";
}

/** Accessible dialog: focus moves in, Tab stays inside, Escape and the backdrop close it. */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  variant = "drawer",
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const origin = useRef<Origin | null>(null);
  const { render, exiting, finish } = usePresence(open);
  const kind: EnterKind = origin.current ? "origin" : variant === "modal" ? "drop" : "sheet";

  // Opening: remember what was tapped, then grow the panel out of it.
  useLayoutEffect(() => {
    if (!open) return;
    origin.current = recentOrigin();
    const k: EnterKind = origin.current ? "origin" : variant === "modal" ? "drop" : "sheet";
    if (ref.current) playEnter(ref.current, backdropRef.current, k, origin.current);
  }, [open, variant]);

  // Closing: shrink back into the same control, then let go of the panel.
  useLayoutEffect(() => {
    if (!exiting || !ref.current) return;
    let live = true;
    void playExit(ref.current, backdropRef.current, kind, origin.current).then(() => {
      if (live) finish();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!render) return null;
  const panel =
    variant === "modal"
      ? "bottom-0 max-h-[92dvh] w-full rounded-t-card lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:max-h-[86dvh] lg:w-[min(44rem,92vw)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-card"
      : "bottom-0 max-h-[92dvh] w-full rounded-t-card lg:bottom-0 lg:left-auto lg:right-0 lg:top-0 lg:max-h-none lg:h-dvh lg:w-[34rem] lg:rounded-none lg:rounded-l-card";
  return (
    <div className={`fixed inset-0 z-40 ${exiting ? "pointer-events-none" : ""}`}>
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`absolute flex flex-col border border-line bg-surface-1 shadow-[var(--lv-shadow-raised)] outline-none ${panel}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 id={titleId} className="m-0 text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="lv-btn lv-btn-ghost lv-btn-sm"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
