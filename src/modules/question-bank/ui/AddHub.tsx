import type { ReactNode } from "react";
import { Dialog, Button } from "../../../ui-kit/index.ts";
import { FeatureIcon } from "../../../app/FeatureIcon.tsx";
import type { FeatureIcon as IconName } from "../../../app/features.ts";

export type AddChoice = "write" | "ai" | "prompt" | "paste" | "upload" | "subject";

const CHOICES: { id: AddChoice; icon: IconName; title: string; text: ReactNode }[] = [
  {
    id: "write",
    icon: "add",
    title: "Write one question",
    text: "Type a question and its options yourself.",
  },
  {
    id: "ai",
    icon: "prompt",
    title: "Generate with AI",
    text: "Connect your own AI account. Learivo writes the questions, and you check them before saving.",
  },
  {
    id: "prompt",
    icon: "prompt",
    title: "Make a prompt for AI",
    text: "Fill in subject, topic, exam and tags. Copy the prompt, then add notes or photos in AI.",
  },
  {
    id: "paste",
    icon: "import",
    title: "Paste what AI gave you",
    text: "Paste the JSON, check it, and save many questions at once.",
  },
  {
    id: "upload",
    icon: "export",
    title: "Upload a file",
    text: "Bring in a JSON or CSV file, such as an earlier export.",
  },
  {
    id: "subject",
    icon: "subjects",
    title: "Add a subject or topic first",
    text: "Set up subjects, chapters and topics so new questions land in the right place.",
  },
];

/** One clear starting point for adding questions: each way in, in plain words. */
export default function AddHub({
  onChoose,
  onClose,
}: {
  onChoose: (c: AddChoice) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      variant="modal"
      title="Add questions"
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {CHOICES.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onChoose(c.id)}
              className="flex w-full items-start gap-3 rounded-control border border-line bg-surface p-3 text-left hover:bg-surface-2 focus-visible:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-2 text-accent"
              >
                <FeatureIcon name={c.icon} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{c.title}</span>
                <span className="block text-sm text-muted">{c.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
