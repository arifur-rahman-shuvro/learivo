import { Button } from "../../../design-system/index.ts";
import { MAX_OPTIONS, type AnswerSpec, type QuestionType } from "../domain/model.ts";

interface Props {
  qtype: QuestionType;
  answer: AnswerSpec;
  onChange: (next: AnswerSpec) => void;
}

const remove = <T,>(list: T[], i: number) => list.filter((_, k) => k !== i);
const replace = <T,>(list: T[], i: number, v: T) => list.map((x, k) => (k === i ? v : x));

/** The part of the editor that depends on the question type. */
export function AnswerEditor({ qtype, answer, onChange }: Props) {
  if ("options" in answer) {
    const single = qtype !== "multi_select";
    const { options } = answer;
    return (
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold">
          Options{" "}
          <span className="font-normal text-muted">
            {single ? "(pick the correct one)" : "(tick every correct one)"}
          </span>
        </legend>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type={single ? "radio" : "checkbox"}
              name="correct-option"
              aria-label={`Option ${i + 1} is correct`}
              checked={o.correct}
              onChange={(e) =>
                onChange({
                  options: options.map((x, k) =>
                    single
                      ? { ...x, correct: k === i }
                      : k === i
                        ? { ...x, correct: e.target.checked }
                        : x,
                  ),
                })
              }
              className="size-5 shrink-0 accent-[var(--lv-accent)]"
            />
            <input
              className="lv-input"
              aria-label={`Option ${i + 1} text`}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              value={o.text}
              onChange={(e) =>
                onChange({ options: replace(options, i, { ...o, text: e.target.value }) })
              }
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove option ${i + 1}`}
              disabled={options.length <= 2}
              onClick={() => onChange({ options: remove(options, i) })}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={options.length >= MAX_OPTIONS}
            onClick={() => onChange({ options: [...options, { text: "", correct: false }] })}
          >
            Add option
          </Button>
        </div>
      </fieldset>
    );
  }

  if ("answer" in answer) {
    return (
      <fieldset className="m-0 flex gap-4 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold">Correct answer</legend>
        {[true, false].map((v) => (
          <label key={String(v)} className="flex items-center gap-2">
            <input
              type="radio"
              name="tf"
              checked={answer.answer === v}
              onChange={() => onChange({ answer: v })}
              className="size-5 accent-[var(--lv-accent)]"
            />
            {v ? "True" : "False"}
          </label>
        ))}
      </fieldset>
    );
  }

  if ("accepted" in answer) {
    const { accepted } = answer;
    return (
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold">
          Accepted answers <span className="font-normal text-muted">(any one is correct)</span>
        </legend>
        {accepted.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="lv-input"
              aria-label={`Accepted answer ${i + 1}`}
              value={a}
              onChange={(e) => onChange({ accepted: replace(accepted, i, e.target.value) })}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove accepted answer ${i + 1}`}
              disabled={accepted.length <= 1}
              onClick={() => onChange({ accepted: remove(accepted, i) })}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={accepted.length >= 20}
            onClick={() => onChange({ accepted: [...accepted, ""] })}
          >
            Add accepted answer
          </Button>
        </div>
      </fieldset>
    );
  }

  const { blanks } = answer;
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-semibold">
        Blanks{" "}
        <span className="font-normal text-muted">
          (write {"{{1}}"}, {"{{2}}"} in the question)
        </span>
      </legend>
      {blanks.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-sm text-muted">Blank {i + 1}</span>
          <input
            className="lv-input"
            aria-label={`Accepted answers for blank ${i + 1}`}
            placeholder="Separate accepted answers with a semicolon"
            value={b.accepted.join("; ")}
            onChange={(e) =>
              onChange({
                blanks: replace(blanks, i, {
                  accepted: e.target.value.split(";").map((s) => s.replace(/^\s+/, "")),
                }),
              })
            }
          />
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove blank ${i + 1}`}
            disabled={blanks.length <= 1}
            onClick={() => onChange({ blanks: remove(blanks, i) })}
          >
            Remove
          </Button>
        </div>
      ))}
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={blanks.length >= 10}
          onClick={() => onChange({ blanks: [...blanks, { accepted: [""] }] })}
        >
          Add blank
        </Button>
      </div>
    </fieldset>
  );
}
