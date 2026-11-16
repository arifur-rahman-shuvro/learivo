import { useMemo, useState } from "react";
import { Button, Dialog } from "../design-system/index.ts";
import { FeatureIcon } from "./FeatureIcon.tsx";
import { FEATURE_GROUPS, type Feature } from "./features.ts";
import { openGuide } from "./guide.ts";
import { sendIntent } from "./intents.ts";

/** Every feature in one place, grouped, each with an icon and a one-line description. */
export default function FeaturesDialog({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  const [find, setFind] = useState("");
  const groups = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return FEATURE_GROUPS;
    return FEATURE_GROUPS.map((g) => ({
      ...g,
      features: g.features.filter((f) => `${f.title} ${f.description}`.toLowerCase().includes(q)),
    })).filter((g) => g.features.length > 0);
  }, [find]);

  function go(f: Feature) {
    onClose();
    if (f.action === "guide") {
      openGuide();
      return;
    }
    if (f.action) sendIntent({ kind: f.action });
    else if (f.target) sendIntent({ kind: "open", target: f.target });
    onNavigate(f.route);
  }

  return (
    <Dialog
      open={open}
      variant="modal"
      title="All features"
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="feature-find" className="text-sm font-semibold">
            Find a feature
          </label>
          <input
            id="feature-find"
            type="search"
            className="lv-input"
            placeholder="For example: import, flashcards, streak"
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
        </div>
        {groups.length === 0 && <p className="m-0 text-sm text-muted">No feature matches that.</p>}
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title} className="flex flex-col gap-2">
            <h3 className="m-0 text-base font-semibold">{g.title}</h3>
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
              {g.features.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => go(f)}
                    className="flex h-full w-full items-start gap-3 rounded-control border border-line bg-surface p-3 text-left hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-2 text-accent"
                    >
                      <FeatureIcon name={f.icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{f.title}</span>
                      <span className="block text-sm text-muted">{f.description}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
