import { useState } from "react";
import { MOTION } from "./tokens.ts";

/**
 * Origin motion: a panel that opens grows out of the thing the student touched and shrinks back
 * into it when it closes. The last tap is remembered, so no screen has to say where a panel came
 * from. Only transform and opacity are animated, which keeps it smooth on a phone.
 */

const EASE_OUT = MOTION.ease.out;
const EASE_IN = MOTION.ease.in;
const OPEN_MS = MOTION.ms.open;
const CLOSE_MS = MOTION.ms.close;

export interface Origin {
  /** Centre of the touched control, in screen pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  el: Element | null;
}

let last: (Origin & { at: number }) | null = null;
let tracking = false;
const MAX_AGE_MS = 1000;
const CONTROL = 'button, a, [role="button"], [role="menuitem"], [role="tab"], summary, label';

function measure(target: EventTarget | null): (Origin & { at: number }) | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest(CONTROL);
  if (!control || control.closest('[data-origin="none"]')) return null;
  // A menu can name the control it belongs to, so its items open panels from that control.
  const from = control.closest("[data-origin-from]")?.getAttribute("data-origin-from");
  const anchor = (from && document.getElementById(from)) || control;
  const r = anchor.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    w: r.width,
    h: r.height,
    el: anchor,
    at: Date.now(),
  };
}

/** Starts remembering the last touched control. Safe to call more than once. */
export function trackOrigins() {
  if (tracking || typeof document === "undefined") return;
  tracking = true;
  const remember = (e: Event) => {
    const o = measure(e.target);
    if (o) last = o;
  };
  document.addEventListener("click", remember, true);
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" || e.key === " ") remember(e);
    },
    true,
  );
}

/** The control that was just touched, or null when the panel was opened some other way. */
export function recentOrigin(): Origin | null {
  if (!last || Date.now() - last.at > MAX_AGE_MS) return null;
  return { x: last.x, y: last.y, w: last.w, h: last.h, el: last.el };
}

/** Where the origin is now. If its control has gone from the page, the remembered spot is used. */
function currentRect(o: Origin) {
  if (o.el?.isConnected) {
    const r = o.el.getBoundingClientRect();
    if (r.width > 0 || r.height > 0)
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }
  return o;
}

/** True when the student asked for less motion (phone setting or the Low effects switch). */
export function motionOff(): boolean {
  if (typeof document === "undefined") return true;
  if (document.documentElement.dataset.effects === "low") return true;
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function canAnimate(): boolean {
  return (
    !motionOff() &&
    typeof Element !== "undefined" &&
    typeof Element.prototype.animate === "function"
  );
}

/** The start (or end) pose of a panel that sits at the origin: small, moved there, see-through. */
export function originPose(panel: Element, o: Origin) {
  const r = panel.getBoundingClientRect();
  const at = currentRect(o);
  const scale = Math.min(0.6, Math.max(0.12, Math.max(at.w / r.width, at.h / r.height)));
  const dx = at.x - (r.left + r.width / 2);
  const dy = at.y - (r.top + r.height / 2);
  return { transform: `translate(${dx}px, ${dy}px) scale(${scale})` };
}

export type EnterKind = "origin" | "sheet" | "drop";

/** Plays the opening motion. Returns nothing: the panel is usable from the first frame. */
export function playEnter(
  panel: HTMLElement,
  backdrop: HTMLElement | null,
  kind: EnterKind,
  origin: Origin | null,
) {
  if (!canAnimate()) return;
  backdrop?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS, easing: "ease-out" });
  if (kind === "origin" && origin) {
    panel.animate(
      [
        { ...originPose(panel, origin), opacity: 0 },
        { transform: "translate(0, 0) scale(1)", opacity: 1, offset: 1 },
      ],
      { duration: OPEN_MS + 40, easing: EASE_OUT },
    );
    // Fade in faster than it grows, so the panel is readable early.
    panel.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: OPEN_MS * 0.5,
      easing: "ease-out",
    });
    return;
  }
  const from = kind === "drop" ? "translateY(-24px) scale(0.98)" : "translateY(56px)";
  panel.animate(
    [
      { transform: from, opacity: 0 },
      { transform: "none", opacity: 1 },
    ],
    {
      duration: OPEN_MS,
      easing: EASE_OUT,
    },
  );
}

/** Plays the closing motion and resolves when it is done. Quicker than opening. */
export function playExit(
  panel: HTMLElement,
  backdrop: HTMLElement | null,
  kind: EnterKind,
  origin: Origin | null,
): Promise<void> {
  if (!canAnimate()) return Promise.resolve();
  backdrop?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: CLOSE_MS,
    easing: "ease-in",
    fill: "forwards",
  });
  const to =
    kind === "origin" && origin
      ? { ...originPose(panel, origin), opacity: 0 }
      : {
          transform: kind === "drop" ? "translateY(-16px) scale(0.98)" : "translateY(40px)",
          opacity: 0,
        };
  const a = panel.animate([{ transform: "translate(0, 0) scale(1)", opacity: 1 }, to], {
    duration: CLOSE_MS,
    easing: EASE_IN,
    fill: "forwards",
  });
  return new Promise((resolve) => {
    const done = () => resolve();
    a.onfinish = done;
    a.oncancel = done;
    setTimeout(done, CLOSE_MS + 150); // never leave a panel stuck on screen
  });
}

/**
 * Keeps something on screen while its closing motion plays. `render` is true while open and
 * during the exit; call `finish` when the exit is over. With reduced motion there is no exit, so
 * the panel disappears at once.
 */
export function usePresence(open: boolean) {
  const [exiting, setExiting] = useState(false);
  const [prev, setPrev] = useState(open);
  if (open !== prev) {
    setPrev(open);
    setExiting(!open && canAnimate());
  }
  return { render: open || exiting, exiting, finish: () => setExiting(false) };
}
