import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog } from "../../../ui-kit/index.ts";
import type { QuestionInput } from "../../question-bank/domain/model.ts";
import { paperHtml } from "../../question-bank/domain/paper.ts";
import type { QuestionRepo } from "../../question-bank/data/repo.ts";
import { drawExamPaper } from "./start.ts";
import { errorText } from "../../question-bank/ui/bank.tsx";
import type { Exam } from "../data/repo.ts";

/** Makes a printable paper from a saved exam: its details, then the questions in sections by type. */
export function ExamPaperDialog({
  exam,
  bank,
  onClose,
}: {
  exam: Exam;
  bank: QuestionRepo;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState<QuestionInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(true);
  const [explanations, setExplanations] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  // Picks the exam's questions by its rules; called again for a different set.
  const load = useCallback(() => {
    setQuestions(null);
    setError(null);
    drawExamPaper(bank, exam).then(setQuestions, (e) => setError(errorText(e)));
  }, [bank, exam]);
  useEffect(load, [load]);

  const html = useMemo(
    () =>
      questions
        ? paperHtml(questions, {
            title: exam.title,
            key,
            explanations,
            exam: {
              instructions: exam.instructions,
              minutes: exam.timeLimitSec ? Math.round(exam.timeLimitSec / 60) : null,
              marksCorrect: exam.marksCorrect,
              marksWrong: exam.marksWrong,
            },
          })
        : "",
    [questions, exam, key, explanations],
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
    a.download = `${exam.title.replace(/[^\w-]+/g, "-").slice(0, 40) || "exam"}-paper.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Dialog
      open
      variant="modal"
      title="Print the exam paper"
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
          The paper has your exam&apos;s title, instructions, time and marks, with the questions in
          sections by type. In the print window choose &quot;Save as PDF&quot; to keep a file.
        </p>
        <div>
          <Button variant="secondary" size="sm" disabled={!questions} onClick={load}>
            Pick different questions
          </Button>
        </div>
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
        {!questions && !error && <p className="m-0 text-sm text-muted">Picking questions…</p>}
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
