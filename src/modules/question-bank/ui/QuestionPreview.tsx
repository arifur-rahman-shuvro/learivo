import { BLANK_PATTERN, TYPE_LABELS, type QuestionInput } from "../domain/model.ts";

/** A question as a student will see it. Read-only. */
export function QuestionPreview({ question: q }: { question: QuestionInput }) {
  const stem = q.qtype === "fill_blank" ? q.stem.replace(BLANK_PATTERN, "________") : q.stem;
  const options = "options" in q.answer ? q.answer.options : [];
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-xs text-muted">{TYPE_LABELS[q.qtype]}</p>
      <p className="m-0 whitespace-pre-wrap font-semibold">{stem || "(No question text yet)"}</p>
      {options.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {options.map((o, i) => (
            <li
              key={i}
              className={`flex items-center gap-2.5 rounded-control border px-3 py-2 text-sm ${
                o.correct ? "border-success bg-surface-2" : "border-line"
              }`}
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line-strong text-[11px] font-semibold">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{o.text || "(empty)"}</span>
              {o.correct && <span className="text-xs font-semibold text-success">Correct</span>}
            </li>
          ))}
        </ul>
      )}
      {"answer" in q.answer && (
        <p className="m-0 text-sm">
          Correct answer: <strong>{q.answer.answer ? "True" : "False"}</strong>
        </p>
      )}
      {"accepted" in q.answer && (
        <p className="m-0 text-sm">
          Accepted answers:{" "}
          <strong>{q.answer.accepted.filter(Boolean).join(", ") || "none yet"}</strong>
        </p>
      )}
      {"blanks" in q.answer && (
        <ol className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
          {q.answer.blanks.map((b, i) => (
            <li key={i}>
              Blank {i + 1}: <strong>{b.accepted.filter(Boolean).join(", ") || "none yet"}</strong>
            </li>
          ))}
        </ol>
      )}
      {q.explanation && (
        <div className="rounded-control border border-line bg-surface-2 p-3 text-sm">
          <div className="mb-1 font-semibold">Explanation</div>
          <p className="m-0 whitespace-pre-wrap">{q.explanation}</p>
        </div>
      )}
    </div>
  );
}
