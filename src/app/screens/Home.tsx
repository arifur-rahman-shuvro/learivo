import { Badge, Button, PlusIcon, ProgressRing } from "../../design-system/index.ts";

const steps = [
  { title: "Add your questions", detail: "Type them in, or import a JSON or CSV file." },
  { title: "Practise a set", detail: "Pick a subject or topic and answer with instant feedback." },
  { title: "Review your mistakes", detail: "Questions you miss come back for revision." },
];

const stats = [
  { label: "Questions", value: "0" },
  { label: "Due for revision", value: "0" },
  { label: "Day streak", value: "0" },
  { label: "Accuracy", value: "–" },
];

/** A question card as it will look when practising. Static example, not stored data. */
function ExampleCard() {
  const options = ["Aspirin", "Warfarin", "Heparin", "Clopidogrel"];
  return (
    <div
      aria-hidden="true"
      className="rounded-card border border-line bg-surface-1 p-4 shadow-[var(--lv-shadow-card)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <Badge tone="accent">Example</Badge>
        <span className="text-xs text-muted">Single best answer</span>
      </div>
      <p className="mb-3 text-sm font-semibold">Which drug inhibits vitamin K–dependent factors?</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {options.map((o, i) => (
          <li
            key={o}
            className={`flex items-center gap-2.5 rounded-control border px-3 py-2 text-sm ${
              i === 1 ? "border-accent bg-surface-2 font-semibold" : "border-line"
            }`}
          >
            <span
              className={`grid size-5 place-items-center rounded-full border text-[11px] font-semibold ${
                i === 1 ? "border-accent bg-accent text-on-accent" : "border-line-strong text-muted"
              }`}
            >
              {String.fromCharCode(65 + i)}
            </span>
            {o}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="lv-card grid gap-6 p-5 sm:p-7 md:grid-cols-[1.15fr_1fr] md:items-center">
        <div className="flex flex-col gap-4">
          <h1 id="module-title" className="m-0 text-3xl font-bold leading-tight sm:text-4xl">
            Your question bank starts here
          </h1>
          <p className="m-0 max-w-[46ch] text-base text-muted">
            Add the questions you study from. Practise them, sit timed exams, and see exactly what
            to revise next. Everything is private to you.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button icon={<PlusIcon />} onClick={() => onNavigate("#/questions")}>
              Add a question
            </Button>
            <Button variant="secondary" onClick={() => onNavigate("#/questions")}>
              Import a file
            </Button>
          </div>
        </div>
        <ExampleCard />
      </section>

      <section aria-label="Your numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="lv-card p-4">
            <div className="text-3xl font-bold tabular-nums">{s.value}</div>
            <div className="mt-1 text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="start-title" className="lv-card p-5 sm:p-6">
          <h2 id="start-title" className="m-0 mb-4 text-lg font-bold">
            Get started
          </h2>
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-3.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong text-sm font-bold">
                  {i + 1}
                </span>
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm text-muted">{s.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="goal-title"
          className="lv-card flex items-center gap-5 p-5 sm:p-6"
        >
          <ProgressRing value={0} size={88} label="Daily goal progress" />
          <div>
            <h2 id="goal-title" className="m-0 text-lg font-bold">
              Daily goal
            </h2>
            <p className="m-0 mt-1 text-sm text-muted">
              0 of 20 questions today. Set your own target in Settings once practice is built.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
