import { useState } from "react";
import { Button, Dialog } from "../../../design-system/index.ts";
import { errorText } from "../../question-bank/ui/bank.tsx";
import {
  DEFAULT_HOME_LAYOUT,
  HOME_SECTIONS,
  moveSection,
  toggleSection,
  type HomeLayout,
} from "../domain/homeLayout.ts";

interface Props {
  layout: HomeLayout;
  onSave: (layout: HomeLayout) => Promise<void>;
  onClose: () => void;
}

/** Choose which Home sections show and move them up or down. Buttons only, so it works by touch. */
export default function CustomizeDialog({ layout, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(layout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const label = (id: string) => HOME_SECTIONS.find((s) => s.id === id)!.label;

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      variant="modal"
      title="Customize Home"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto"
            disabled={busy}
            onClick={() => setDraft(DEFAULT_HOME_LAYOUT)}
          >
            Reset
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save layout"}
          </Button>
        </>
      }
    >
      <p className="m-0 mb-3 text-sm text-muted">
        Show or hide sections and set their order. Your choice is saved to your account.
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {draft.order.map((id, i) => (
          <li
            key={id}
            className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2"
          >
            <label className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={!draft.hidden.includes(id)}
                onChange={() => setDraft(toggleSection(draft, id))}
              />
              <span className="truncate">{label(id)}</span>
            </label>
            <span className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move ${label(id)} up`}
                disabled={i === 0}
                onClick={() => setDraft(moveSection(draft, id, -1))}
              >
                Up
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move ${label(id)} down`}
                disabled={i === draft.order.length - 1}
                onClick={() => setDraft(moveSection(draft, id, 1))}
              >
                Down
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="m-0 mt-3 text-sm font-medium">
          {error}
        </p>
      )}
    </Dialog>
  );
}
