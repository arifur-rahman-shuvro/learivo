import { useId, useState } from "react";
import { CheckIcon } from "../ui-kit/index.ts";
import { Button } from "../ui-kit/index.ts";

/* ----------------------------------------------------------------------------------------------
 * A question you can answer on the page, with no account. Nothing is saved.
 * ------------------------------------------------------------------------------------------- */

const STEM =
  "A 58-year-old man has had crushing central chest pain for 40 minutes. His ECG shows ST elevation in leads II, III and aVF. Which coronary artery is most likely blocked?";
const OPTIONS = [
  "Left anterior descending artery",
  "Right coronary artery",
  "Left circumflex artery",
  "Left main stem",
];
const RIGHT = 1;
const WHY =
  "ST elevation in II, III and aVF is an inferior infarct. In most people the right coronary artery supplies the inferior wall. Anterior changes (V1 to V4) point to the left anterior descending artery, and lateral changes (I, aVL, V5 and V6) to the circumflex.";

type Sure = "sure" | "unsure" | "guess";
const SURENESS: { id: Sure; label: string }[] = [
  { id: "sure", label: "Sure" },
  { id: "unsure", label: "Not sure" },
  { id: "guess", label: "Guessing" },
];

/** What Learivo does with the answer, by whether it was right and how sure the student was. */
function outcome(right: boolean, sure: Sure): string {
  if (right && sure === "sure") return "Right and sure. Learivo counts this one as known.";
  if (right)
    return "Right, but unsure. Learivo lists it under “Right but unsure” so you can firm it up.";
  if (sure === "sure")
    return "Sure, but wrong. Learivo lists it under “Sure but wrong” and adds it to your revision.";
  return "Wrong, and you knew you were unsure. Learivo adds it to your revision.";
}

export function TryQuestion() {
  const [picked, setPicked] = useState<number | null>(null);
  const [sure, setSure] = useState<Sure | null>(null);
  const done = picked !== null && sure !== null;
  const right = picked === RIGHT;
  const groupId = useId();

  const reset = () => {
    setPicked(null);
    setSure(null);
  };

  return (
    <div className="lp-stack">
      <section aria-labelledby={`${groupId}-q`} className="lp-card flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={`${groupId}-q`} className="m-0 text-sm font-semibold text-muted">
            Try a question
          </h2>
          <span className="text-xs text-muted">No account needed</span>
        </div>
        <p className="m-0 text-base leading-relaxed">{STEM}</p>

        <div role="radiogroup" aria-label="Answers" className="flex flex-col gap-2">
          {OPTIONS.map((text, i) => {
            const state = !done
              ? picked === i
                ? "picked"
                : "idle"
              : i === RIGHT
                ? "right"
                : i === picked
                  ? "wrong"
                  : "dim";
            return (
              <button
                key={text}
                type="button"
                role="radio"
                aria-checked={picked === i}
                disabled={done}
                data-state={state}
                className="lp-option"
                onClick={() => setPicked(i)}
              >
                <span className="lp-letter" aria-hidden="true">
                  {state === "right" ? <CheckIcon size={16} /> : String.fromCharCode(65 + i)}
                </span>
                <span className="pt-0.5">{text}</span>
              </button>
            );
          })}
        </div>

        {picked !== null && sure === null && (
          <div role="group" aria-label="How sure are you?" className="flex flex-col gap-2">
            <p className="m-0 text-sm font-semibold">How sure are you?</p>
            <div className="flex flex-wrap gap-2">
              {SURENESS.map((s) => (
                <Button key={s.id} variant="secondary" onClick={() => setSure(s.id)}>
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="lp-reveal" data-open={done} aria-live="polite">
          <div>
            {done && (
              <div className="flex flex-col gap-3 border-t border-line pt-4">
                <p className="m-0 font-semibold">
                  {right
                    ? "Correct: right coronary artery."
                    : "Not quite: the answer is the right coronary artery."}
                </p>
                <p className="m-0 text-sm text-muted">{WHY}</p>
                <p className="m-0 rounded-control bg-surface-2 p-3 text-sm">
                  {outcome(right, sure)}
                </p>
                <div>
                  <Button variant="ghost" onClick={reset}>
                    Try again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------
 * Right or wrong, sure or unsure: the four kinds of answer.
 * ------------------------------------------------------------------------------------------- */

const QUADS = [
  {
    id: "known",
    row: "Sure",
    col: "Right",
    name: "Known",
    text: "You were right and you knew it. This is where your time is already paying off, so spend it elsewhere.",
  },
  {
    id: "shaky",
    row: "Unsure",
    col: "Right",
    name: "Right but unsure",
    text: "Right by instinct or luck. It can fail on a different day, so Learivo lists these for you to firm up.",
  },
  {
    id: "over",
    row: "Sure",
    col: "Wrong",
    name: "Sure but wrong",
    text: "The costly kind. You would write the same mistake in the exam with full confidence. Learivo lists these so you can fix them on purpose.",
  },
  {
    id: "gap",
    row: "Unsure",
    col: "Wrong",
    name: "Known gap",
    text: "You knew you did not know. It is an honest gap, and Learivo adds the question to your revision.",
  },
] as const;

export function ConfidenceMatrix() {
  const [id, setId] = useState<(typeof QUADS)[number]["id"]>("over");
  const shown = QUADS.find((q) => q.id === id)!;
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Kinds of answer" className="grid grid-cols-2 gap-2">
        {QUADS.map((q) => (
          <button
            key={q.id}
            type="button"
            className="lp-quad"
            data-tone={q.id}
            aria-pressed={id === q.id}
            onClick={() => setId(q.id)}
          >
            <span className="block text-xs text-muted">
              {q.col}, {q.row.toLowerCase()}
            </span>
            <span className="mt-1 block font-semibold">{q.name}</span>
          </button>
        ))}
      </div>
      <p role="status" className="lp-card m-0 p-4 text-sm leading-relaxed">
        <strong>{shown.name}. </strong>
        {shown.text}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------
 * Work backwards from exam day.
 * ------------------------------------------------------------------------------------------- */

export function PaceDemo() {
  const [days, setDays] = useState(60);
  const [left, setLeft] = useState(1500);
  const perDay = Math.ceil(left / days);
  const weeks = days >= 14 ? Math.round(days / 7) : null;
  const dId = useId();
  const lId = useId();
  return (
    <div className="lp-card flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <label htmlFor={dId} className="flex justify-between gap-3 text-sm font-semibold">
          <span>Days until your exam</span>
          <span className="tabular-nums">{days}</span>
        </label>
        <input
          id={dId}
          className="lp-range"
          type="range"
          min={7}
          max={180}
          step={1}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={lId} className="flex justify-between gap-3 text-sm font-semibold">
          <span>Questions you still want to cover</span>
          <span className="tabular-nums">{left.toLocaleString("en")}</span>
        </label>
        <input
          id={lId}
          className="lp-range"
          type="range"
          min={100}
          max={5000}
          step={50}
          value={left}
          onChange={(e) => setLeft(Number(e.target.value))}
        />
      </div>
      <p role="status" className="m-0 border-t border-line pt-4">
        <span
          className="block text-4xl font-bold tabular-nums"
          style={{ letterSpacing: "-0.03em" }}
        >
          {perDay}
        </span>
        <span className="text-sm text-muted">
          questions a day
          {weeks ? `, for about ${weeks} weeks` : ""}. Learivo shows this pace on Home and tells you
          when you fall behind.
        </span>
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------
 * A sheet of paper, as the exam PDF prints it.
 * ------------------------------------------------------------------------------------------- */

export function PaperPreview() {
  return (
    <figure className="m-0 flex flex-col gap-3">
      <div className="lp-paper" aria-hidden="true">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderBottom: "1.5px solid #1a1a1a",
            paddingBottom: 4,
            marginBottom: 8,
            fontWeight: 700,
          }}
        >
          <span>Cardiology mock exam</span>
          <span style={{ fontWeight: 400 }}>20 questions</span>
        </div>
        <div className="lp-paper-cols">
          <p>
            <b>1.</b> A 58-year-old man has crushing chest pain and ST elevation in II, III and aVF.
            Which artery is most likely blocked?
            <br />
            A. Left anterior descending
            <br />
            B. Right coronary
            <br />
            C. Left circumflex
            <br />
            D. Left main stem
          </p>
          <p>
            <b>2.</b> Which drug class reduces mortality after a myocardial infarction with reduced
            ejection fraction?
            <br />
            A. Beta-blockers
            <br />
            B. Loop diuretics
            <br />
            C. Nitrates
            <br />
            D. Calcium channel blockers
          </p>
          <p>
            <b>3.</b> A cyanosed newborn improves on a prostaglandin infusion that keeps the duct
            open. What is the most likely diagnosis?
            <br />
            A. Ventricular septal defect
            <br />
            B. Transposition of the great arteries
            <br />
            C. Patent ductus arteriosus
            <br />
            D. Coarctation of the aorta
          </p>
          <p>
            <b>4.</b> Which murmur is best heard at the left sternal edge, with the patient sitting
            forward and holding their breath out?
            <br />
            A. Mitral stenosis
            <br />
            B. Aortic regurgitation
            <br />
            C. Tricuspid regurgitation
            <br />
            D. Pulmonary stenosis
          </p>
        </div>
        <div style={{ textAlign: "center", fontSize: 9, color: "#666", marginTop: 4 }}>
          Page 1 of 4
        </div>
      </div>
      <figcaption className="text-sm text-muted">
        A sample page. Real papers hold your own questions, with the answer key on its own page at
        the end.
      </figcaption>
    </figure>
  );
}
