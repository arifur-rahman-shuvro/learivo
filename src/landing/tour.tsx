import { useId, useRef, useState } from "react";
import { Button, Segmented } from "../ui-kit/index.ts";

/* ----------------------------------------------------------------------------------------------
 * A tour of the app you can use on the page: four small working screens. Everything is sample
 * data, nothing is saved, and each screen says so.
 * ------------------------------------------------------------------------------------------- */

const SUBJECTS = ["Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology", "Medicine"];

function TestBuilder({ onCreate }: { onCreate: () => void }) {
  const [subjects, setSubjects] = useState<string[]>(["Physiology", "Pharmacology"]);
  const [feedback, setFeedback] = useState("instant");
  const [source, setSource] = useState("unattempted");
  const [count, setCount] = useState(20);
  const countId = useId();
  const toggle = (s: string) =>
    setSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const minutes = Math.round(count * 1.5);
  const from =
    source === "mistakes"
      ? "your mistakes"
      : source === "unattempted"
        ? "questions you have not tried"
        : "all your questions";
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold">Subjects</legend>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              className="lp-chip"
              aria-pressed={subjects.includes(s)}
              onClick={() => toggle(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented
          label="Feedback"
          value={feedback}
          onChange={setFeedback}
          options={[
            { value: "instant", label: "After each" },
            { value: "timed", label: "Timed" },
          ]}
        />
        <Segmented
          label="Draw from"
          value={source}
          onChange={setSource}
          options={[
            { value: "unattempted", label: "New" },
            { value: "mistakes", label: "Mistakes" },
            { value: "all", label: "Any" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={countId} className="flex justify-between gap-3 text-sm font-semibold">
          <span>Number of questions</span>
          <span className="tabular-nums">{count}</span>
        </label>
        <input
          id={countId}
          className="lp-range"
          type="range"
          min={5}
          max={80}
          step={5}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p role="status" className="m-0 text-sm leading-relaxed">
          <strong>
            {count} questions from{" "}
            {subjects.length === 0
              ? "every subject"
              : subjects.length === 1
                ? subjects[0]
                : `${subjects.length} subjects`}
          </strong>
          , drawn from {from}.{" "}
          {feedback === "instant"
            ? "The answer and explanation show after each question."
            : `A ${minutes}-minute timer runs and the answers show at the end.`}
        </p>
        <div>
          <Button onClick={onCreate}>Build your own test</Button>
        </div>
      </div>
    </div>
  );
}

type Cell = "open" | "done" | "flag";
const START: Cell[] = Array.from({ length: 40 }, (_, i) =>
  [0, 1, 2, 3, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 20, 21, 22, 24].includes(i)
    ? "done"
    : [4, 11, 18].includes(i)
      ? "flag"
      : "open",
);
const NEXT: Record<Cell, Cell> = { open: "done", done: "flag", flag: "open" };
const CELL_WORD: Record<Cell, string> = {
  open: "not answered",
  done: "answered",
  flag: "flagged for review",
};

function ExamNavigator() {
  const [cells, setCells] = useState<Cell[]>(START);
  const [onlyFlags, setOnlyFlags] = useState(false);
  const n = (c: Cell) => cells.filter((x) => x === c).length;
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        An exam shows every question at a glance. Tap a number to mark it answered, flagged or not
        answered.
      </p>
      <div role="group" aria-label="Questions" className="lp-nav-grid">
        {cells.map((c, i) => (
          <button
            key={i}
            type="button"
            className="lp-cell"
            data-state={c}
            data-dim={onlyFlags && c !== "flag"}
            aria-label={`Question ${i + 1}, ${CELL_WORD[c]}`}
            onClick={() => setCells((cur) => cur.map((x, j) => (j === i ? NEXT[x] : x)))}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p role="status" className="m-0 text-sm">
          <strong className="tabular-nums">{n("done")}</strong> answered,{" "}
          <strong className="tabular-nums">{n("flag")}</strong> flagged,{" "}
          <strong className="tabular-nums">{n("open")}</strong> left
        </p>
        <Button
          variant="secondary"
          aria-pressed={onlyFlags}
          onClick={() => setOnlyFlags((v) => !v)}
        >
          {onlyFlags ? "Show all" : "Focus on flagged"}
        </Button>
      </div>
    </div>
  );
}

const AREAS: { name: string; score: number; answers: number }[] = [
  { name: "Cardiology", score: 82, answers: 140 },
  { name: "Renal physiology", score: 54, answers: 62 },
  { name: "Neuroanatomy", score: 67, answers: 88 },
  { name: "Pharmacology: antimicrobials", score: 48, answers: 71 },
  { name: "Biochemistry: metabolism", score: 73, answers: 95 },
  { name: "Pathology: inflammation", score: 90, answers: 52 },
];

function InsightsChart() {
  const [sort, setSort] = useState("weak");
  const [open, setOpen] = useState<string | null>("Pharmacology: antimicrobials");
  const rows = [...AREAS].sort((a, b) =>
    sort === "weak" ? a.score - b.score : a.name.localeCompare(b.name),
  );
  const shown = AREAS.find((a) => a.name === open);
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Order"
        value={sort}
        onChange={setSort}
        options={[
          { value: "weak", label: "Weakest first" },
          { value: "az", label: "A to Z" },
        ]}
      />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((a) => (
          <li key={a.name}>
            <button
              type="button"
              className="lp-bar-row"
              aria-pressed={open === a.name}
              onClick={() => setOpen(open === a.name ? null : a.name)}
            >
              <span className="flex justify-between gap-3 text-sm">
                <span className="text-left font-semibold">{a.name}</span>
                <span className="tabular-nums">{a.score}%</span>
              </span>
              <span className="lp-bar" aria-hidden="true">
                <span
                  className="lp-bar-fill"
                  data-tone={a.score < 60 ? "low" : a.score < 75 ? "mid" : "high"}
                  style={{ width: `${a.score}%` }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="lp-card m-0 p-3 text-sm leading-relaxed">
        {shown
          ? `${shown.name}: ${shown.score}% over ${shown.answers} answers. ${
              shown.score < 70
                ? "Under 70%, so Learivo lists it as a weak area and offers a 10-question session on it."
                : "Above 70%, so it is not flagged. Keep it fresh with revision."
            }`
          : "Tap an area to see what Learivo does with it."}
      </p>
    </div>
  );
}

const CARDS = [
  {
    front: "Drug of choice for absence seizures in a child",
    back: "Ethosuximide. Sodium valproate is used when absence seizures come with other seizure types.",
  },
  {
    front: "Which cranial nerve passes through the foramen rotundum?",
    back: "The maxillary nerve (V2).",
  },
  {
    front: "First enzyme of the urea cycle, and where it works",
    back: "Carbamoyl phosphate synthetase I, in the mitochondrial matrix of liver cells.",
  },
];
const AFTER = ["10 minutes", "2 days", "5 days", "12 days"];
const RATE = ["Again", "Hard", "Good", "Easy"];

function RevisionCards() {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [rated, setRated] = useState<number | null>(null);
  const card = CARDS[i % CARDS.length]!;
  const next = () => {
    setI(i + 1);
    setShown(false);
    setRated(null);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="lp-flash">
        <p className="m-0 text-xs text-muted">
          Card {(i % CARDS.length) + 1} of {CARDS.length}
        </p>
        <p className="m-0 text-lg font-semibold leading-snug">{card.front}</p>
        {shown && <p className="m-0 border-t border-line pt-3 leading-relaxed">{card.back}</p>}
      </div>
      {!shown ? (
        <div>
          <Button onClick={() => setShown(true)}>Show answer</Button>
        </div>
      ) : rated === null ? (
        <div
          role="group"
          aria-label="How well did you remember it?"
          className="flex flex-wrap gap-2"
        >
          {RATE.map((r, k) => (
            <Button key={r} variant="secondary" onClick={() => setRated(k)}>
              {r}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3" role="status">
          <p className="m-0 text-sm">
            <strong>{RATE[rated]}.</strong> This card comes back in <strong>{AFTER[rated]}</strong>.
          </p>
          <div>
            <Button variant="secondary" onClick={next}>
              Next card
            </Button>
          </div>
        </div>
      )}
      <p className="m-0 text-xs text-muted">
        Example gaps only. Real ones depend on how often you remember each card.
      </p>
    </div>
  );
}

const TABS = [
  { id: "build", label: "Build a test", note: "Choose what to practise" },
  { id: "exam", label: "Sit an exam", note: "Track every question" },
  { id: "insights", label: "Find weak areas", note: "See where marks go" },
  { id: "revise", label: "Revise", note: "Cards come back on time" },
] as const;

export function Tour({ onCreate }: { onCreate: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("build");
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (e: React.KeyboardEvent, i: number) => {
    const step =
      e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowLeft"
          ? -1
          : e.key === "Home"
            ? -i
            : e.key === "End"
              ? TABS.length - 1 - i
              : 0;
    if (!step) return;
    e.preventDefault();
    const to = TABS[(i + step + TABS.length) % TABS.length]!;
    setTab(to.id);
    refs.current[to.id]?.focus();
  };
  return (
    <div className="lp-window">
      <div role="tablist" aria-label="Parts of Learivo" className="lp-tabs">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            id={`${base}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className="lp-tab"
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => move(e, i)}
          >
            <span className="font-semibold">{t.label}</span>
            <span className="lp-tab-note">{t.note}</span>
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <div
          key={t.id}
          id={`${base}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={tab !== t.id}
          className="lp-panel"
        >
          {tab === t.id && (
            <>
              {t.id === "build" && <TestBuilder onCreate={onCreate} />}
              {t.id === "exam" && <ExamNavigator />}
              {t.id === "insights" && <InsightsChart />}
              {t.id === "revise" && <RevisionCards />}
              <p className="m-0 mt-4 text-xs text-muted">
                A working sample with made-up data. Nothing here is saved.
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------
 * Questions people ask before they sign up. Every answer is something the app does today.
 * ------------------------------------------------------------------------------------------- */

const FAQ: { q: string; a: string }[] = [
  {
    q: "Can I use my own questions?",
    a: "Yes, that is what Learivo is for. Add questions one by one, or import a JSON or CSV file. The Make a prompt tool writes a ready-to-paste request for any AI you like, and you paste its answer back to import it.",
  },
  {
    q: "Does it work without internet?",
    a: "After one online visit, yes. Your question bank is copied to the phone, so you can practise, sit exams and edit offline. Changes wait on the phone and are sent when you are back online.",
  },
  {
    q: "Who can see my questions and results?",
    a: "Only you. They sit in your own account and the database refuses to show them to anyone else. There are no ads and no tracking of what you study.",
  },
  {
    q: "Which kinds of question can I write?",
    a: "Single best answer, single choice, multiple select, true or false and fill in the blank, each with an explanation. Questions are text only, so a question that needs a picture is written out in words.",
  },
  {
    q: "Can I use it on my phone?",
    a: "Yes. It runs in your phone's browser and can be installed to the home screen. It is designed for a phone first and also works on a laptop.",
  },
  {
    q: "Can I take my data with me?",
    a: "Yes. Download everything in one file that Learivo checks for damage, and lock it with a passphrase if you like. You can also delete your account.",
  },
];

export function Faq() {
  return (
    <div className="lp-faq">
      {FAQ.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p className="m-0 text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
