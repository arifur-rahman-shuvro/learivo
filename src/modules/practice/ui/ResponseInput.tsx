import { BLANK_PATTERN } from "../../question-bank/domain/model.ts";
import { grade, type Response, type Snapshot } from "../domain/grading.ts";

interface Props {
  snapshot: Snapshot;
  response: Response | null;
  onChange: (r: Response | null) => void;
  /** Once locked the student can no longer change the answer. */
  locked?: boolean;
  /** Show which answers are right. Only after the student has answered with feedback on. */
  reveal?: boolean;
}

const LETTERS = "ABCDEFGHIJ";

/** Splits a fill-in-the-blank statement around its {{1}} markers. */
export function stemParts(stem: string): string[] {
  return stem.split(BLANK_PATTERN);
}

export default function ResponseInput({ snapshot, response, onChange, locked, reveal }: Props) {
  const { qtype, answer } = snapshot;
  const verdict = reveal ? grade(qtype, answer, response) : null;

  if ("options" in answer) {
    const multi = qtype === "multi_select";
    const chosen = response && "choices" in response ? response.choices : [];
    const toggle = (i: number) => {
      const next = multi
        ? chosen.includes(i)
          ? chosen.filter((x) => x !== i)
          : [...chosen, i]
        : [i];
      onChange(next.length === 0 ? null : { choices: next });
    };
    return (
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="sr-only">{multi ? "Choose all that apply" : "Choose one answer"}</legend>
        {answer.options.map((o, i) => {
          const picked = chosen.includes(i);
          const tone = reveal
            ? o.correct
              ? "border-success bg-surface-2"
              : picked
                ? "border-danger"
                : "border-line"
            : picked
              ? "border-accent bg-surface-2"
              : "border-line";
          return (
            <label
              key={i}
              className={`flex cursor-pointer items-start gap-3 rounded-control border px-3.5 py-3 ${tone} ${locked ? "cursor-default" : ""}`}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name="choice"
                checked={picked}
                disabled={locked}
                onChange={() => toggle(i)}
                className="mt-1 size-4 shrink-0 accent-[var(--lv-accent)]"
              />
              <span className="font-semibold text-muted">{LETTERS[i]}.</span>
              <span className="min-w-0 flex-1 break-words">{o.text}</span>
              {reveal && o.correct && <span className="text-sm font-semibold">Correct</span>}
            </label>
          );
        })}
        {verdict && <Verdict v={verdict} />}
      </fieldset>
    );
  }

  if ("answer" in answer) {
    const value = response && "value" in response ? response.value : null;
    return (
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="sr-only">True or false</legend>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((v) => {
            const picked = value === v;
            const tone = reveal
              ? answer.answer === v
                ? "border-success bg-surface-2"
                : picked
                  ? "border-danger"
                  : "border-line"
              : picked
                ? "border-accent bg-surface-2"
                : "border-line";
            return (
              <label
                key={String(v)}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-control border px-3.5 py-3 font-semibold ${tone}`}
              >
                <input
                  type="radio"
                  name="tf"
                  checked={picked}
                  disabled={locked}
                  onChange={() => onChange({ value: v })}
                  className="size-4 accent-[var(--lv-accent)]"
                />
                {v ? "True" : "False"}
              </label>
            );
          })}
        </div>
        {verdict && <Verdict v={verdict} />}
      </fieldset>
    );
  }

  if ("accepted" in answer) {
    const text = response && "text" in response ? response.text : "";
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor="short-answer" className="text-sm font-semibold">
          Your answer
        </label>
        <input
          id="short-answer"
          className="lv-input"
          value={text}
          disabled={locked}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value.trim() === "" ? null : { text: e.target.value })}
        />
        {verdict && <Verdict v={verdict} />}
        {reveal && <p className="m-0 text-sm text-muted">Accepted: {answer.accepted.join(", ")}</p>}
      </div>
    );
  }

  // Fill in the blank: one input per {{n}} marker.
  const given = response && "blanks" in response ? response.blanks : [];
  const set = (i: number, v: string) => {
    const next = answer.blanks.map((_, k) => (k === i ? v : (given[k] ?? "")));
    onChange(next.every((x) => x.trim() === "") ? null : { blanks: next });
  };
  return (
    <div className="flex flex-col gap-2">
      {answer.blanks.map((b, i) => (
        <div key={i} className="flex flex-col gap-1">
          <label htmlFor={`blank-${i}`} className="text-sm font-semibold">
            Blank {i + 1}
          </label>
          <input
            id={`blank-${i}`}
            className="lv-input"
            value={given[i] ?? ""}
            disabled={locked}
            autoComplete="off"
            onChange={(e) => set(i, e.target.value)}
          />
          {reveal && <p className="m-0 text-sm text-muted">Accepted: {b.accepted.join(", ")}</p>}
        </div>
      ))}
      {verdict && <Verdict v={verdict} />}
    </div>
  );
}

function Verdict({ v }: { v: "correct" | "wrong" | "unanswered" }) {
  const text = v === "correct" ? "Correct" : v === "wrong" ? "Not quite" : "Not answered";
  return (
    <p role="status" className="m-0 text-sm font-semibold">
      {text}
    </p>
  );
}
