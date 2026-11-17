import { Button, Segmented } from "../../../design-system/index.ts";
import { OPTION_MAX, OPTION_MIN, type AnswerSpec, type QuestionType } from "../domain/model.ts";

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
    const single = qtype === "sba" || qtype === "single_choice";
    const tf = qtype === "true_false";
    const { options } = answer;
    return (
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold">
          {tf ? "Statements" : "Options"}{" "}
          <span className="font-normal text-muted">
            {tf
              ? `(${OPTION_MIN} to ${OPTION_MAX} statements, mark each True or False)`
              : single
                ? `(${OPTION_MIN} to ${OPTION_MAX} options, pick the correct one)`
                : `(${OPTION_MIN} to ${OPTION_MAX} options, tick every correct one)`}
          </span>
        </legend>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            {tf ? (
              <Segmented
                hideLabel
                className="w-40 shrink-0"
                label={`Statement ${i + 1} is`}
                value={o.correct ? "T" : "F"}
                options={[
                  { value: "T", label: "True" },
                  { value: "F", label: "False" },
                ]}
                onChange={(v) =>
                  onChange({ options: replace(options, i, { ...o, correct: v === "T" }) })
                }
              />
            ) : (
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
            )}
            <input
              className="lv-input"
              aria-label={tf ? `Statement ${i + 1} text` : `Option ${i + 1} text`}
              placeholder={tf ? `Statement ${i + 1}` : `Option ${String.fromCharCode(65 + i)}`}
              value={o.text}
              onChange={(e) =>
                onChange({ options: replace(options, i, { ...o, text: e.target.value }) })
              }
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${tf ? "statement" : "option"} ${i + 1}`}
              disabled={options.length <= OPTION_MIN}
              onClick={() => {
                const next = remove(options, i);
                // A single-answer question must keep one correct option.
                if (single && !next.some((x) => x.correct) && next[0])
                  next[0] = { ...next[0], correct: true };
                onChange({ options: next });
              }}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={options.length >= OPTION_MAX}
            onClick={() => onChange({ options: [...options, { text: "", correct: false }] })}
          >
            {tf ? "Add statement" : "Add option"}
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
