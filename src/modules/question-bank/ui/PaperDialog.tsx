import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog } from "../../../design-system/index.ts";
import { paperHtml } from "../domain/paper.ts";
import type { QuestionInput } from "../domain/model.ts";
import { errorText, useBank } from "./bank.tsx";

/** Turns selected questions into a paper that can be printed or saved as a PDF. */
export function PaperDialog({
  open,
  ids,
  onClose,
}: {
  open: boolean;
  ids: string[];
  onClose: () => void;
}) {
  const { repo } = useBank();
  const [questions, setQuestions] = useState<QuestionInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Question paper");
  const [key, setKey] = useState(true);
  const [explanations, setExplanations] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setQuestions(null);
    setError(null);
    repo.getMany(ids).then(
      (rows) => {
        if (!alive) return;
        const byId = new Map(rows.map((r) => [r.id, r]));
        setQuestions(ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as QuestionInput] : [])));
      },
      (e) => alive && setError(errorText(e)),
    );
    return () => {
      alive = false;
    };
  }, [open, ids, repo]);

  const html = useMemo(
    () => (questions ? paperHtml(questions, { title, key, explanations }) : ""),
    [questions, title, key, explanations],
  );

  const print = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "question-paper.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Dialog
      open={open}
      variant="modal"
      title="Print a paper"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" disabled={!questions} onClick={download}>
            Download page
          </Button>
          <Button disabled={!questions} onClick={print}>
            Print or save as PDF
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-muted">
          Makes a paper from the {ids.length} selected question{ids.length === 1 ? "" : "s"}. In the
          print window choose &quot;Save as PDF&quot; to keep a file.
        </p>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Paper title
          <input
            className="lv-input font-normal"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--lv-accent)]"
            checked={key}
            onChange={(e) => setKey(e.target.checked)}
          />
          Add an answer key on the last page
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--lv-accent)]"
            checked={explanations}
            disabled={!key}
            onChange={(e) => setExplanations(e.target.checked)}
          />
          Include explanations in the key
        </label>
        {error && (
          <p role="alert" className="m-0 text-sm text-danger">
            {error}
          </p>
        )}
        {questions && (
          <iframe
            ref={frame}
            title="Paper preview"
            srcDoc={html}
            className="h-80 w-full rounded-control border border-line bg-white"
          />
        )}
      </div>
    </Dialog>
  );
}
