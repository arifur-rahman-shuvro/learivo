import { useEffect, useState, type ReactNode } from "react";
import { Button, Dialog, ProgressBar } from "../ui-kit/index.ts";
import { FeatureIcon } from "../help/FeatureIcon.tsx";
import type { FeatureIcon as IconName } from "../help/features.ts";
import { closeGuide, useGuideOpen } from "../core/dialogs/guide.ts";
import { sendIntent, type Intent } from "../core/intents.ts";
import { useBank } from "../modules/question-bank/ui/bank.tsx";
import { usePractice } from "../modules/practice/ui/practice.tsx";
import { useWorkspace } from "../modules/workspace/ui/workspace.tsx";
import { DEFAULT_QUERY } from "../modules/question-bank/data/repo.ts";

interface Step {
  id: string;
  icon: IconName;
  title: string;
  why: string;
  done: boolean;
  go: { label: string; route: string; intent?: Intent };
}

/** Which first steps the student has already done, read from their own data. */
function useProgress() {
  const { repo, rev } = useBank();
  const { attempts } = usePractice();
  const ws = useWorkspace();
  const [state, setState] = useState<Record<string, boolean> | null>(null);
  const open = useGuideOpen();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const [tax, page, recent, cards, exam] = await Promise.all([
        repo.taxonomy().catch(() => []),
        repo.list({ ...DEFAULT_QUERY, limit: 1 }).catch(() => ({ total: 0 })),
        attempts.list(50).catch(() => []),
        ws.repo.flashcards().catch(() => []),
        ws.repo.examTarget().catch(() => ({ date: null })),
      ]);
      if (!alive) return;
      setState({
        subject: tax.length > 0,
        questions: page.total > 0,
        practice: recent.length > 0,
        mistake: recent.some((a) => (a.wrong ?? 0) > 0),
        flashcard: cards.length > 0,
        exam: exam.date !== null,
      });
    })();
    return () => {
      alive = false;
    };
  }, [open, repo, rev, attempts, ws.repo, ws.rev]);
  return state;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-control border border-line bg-surface p-3">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-2 flex flex-col gap-2 text-sm text-muted">{children}</div>
    </details>
  );
}

/** A first-steps checklist that ticks itself, plus short answers to the usual questions. */
export default function GuideDialog({ onNavigate }: { onNavigate: (route: string) => void }) {
  const open = useGuideOpen();
  const done = useProgress();
  const d = (k: string) => done?.[k] ?? false;

  const steps: Step[] = [
    {
      id: "subject",
      icon: "subjects",
      title: "Add a subject",
      why: "Subjects, chapters and topics keep questions organised. Practice and Insights group by them.",
      done: d("subject"),
      go: {
        label: "Add a subject",
        route: "#/questions",
        intent: { kind: "open", target: "subjects" },
      },
    },
    {
      id: "questions",
      icon: "add",
      title: "Add your questions",
      why: "Write one by hand, or let AI make many from your notes or photos. You check them before saving.",
      done: d("questions"),
      go: { label: "Add questions", route: "#/questions", intent: { kind: "open", target: "hub" } },
    },
    {
      id: "practice",
      icon: "practice",
      title: "Practise a session",
      why: "Pick a subject, answer, and see the explanation straight away. Finish to see your marks.",
      done: d("practice"),
      go: { label: "Start practice", route: "#/practice" },
    },
    {
      id: "mistake",
      icon: "mistakes",
      title: "Learn from a mistake",
      why: "On the Results screen, open a wrong answer and tap why you missed it. Insights then shows where your marks go.",
      done: d("mistake"),
      go: { label: "See my results", route: "#/practice" },
    },
    {
      id: "flashcard",
      icon: "flashcards",
      title: "Make a flashcard",
      why: "Good for facts, lists and mnemonics. Cards come back on a schedule so they stick.",
      done: d("flashcard"),
      go: {
        label: "Open flashcards",
        route: "#/review",
        intent: { kind: "open", target: "flashcards" },
      },
    },
    {
      id: "exam",
      icon: "goal",
      title: "Set your exam date",
      why: "Pick the exam date and its subjects. Home counts the days down and shows how many questions a day you need.",
      done: d("exam"),
      go: { label: "Go to Home", route: "#/home" },
    },
  ];
  const count = steps.filter((s) => s.done).length;

  function go(s: Step) {
    closeGuide();
    if (s.go.intent) sendIntent(s.go.intent);
    onNavigate(s.go.route);
  }

  return (
    <Dialog
      open={open}
      variant="modal"
      title="User guide"
      onClose={closeGuide}
      footer={<Button onClick={closeGuide}>Close</Button>}
    >
      <div className="flex flex-col gap-6">
        <section aria-label="First steps" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-base font-semibold">First steps</h3>
            <p className="m-0 text-sm text-muted" aria-live="polite">
              {done === null
                ? "Checking your progress…"
                : count === steps.length
                  ? "All done. You know your way around."
                  : `${count} of ${steps.length} done. Each step ticks itself when you finish it.`}
            </p>
            <ProgressBar
              value={done === null ? 0 : (count / steps.length) * 100}
              label="Guide progress"
            />
          </div>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {steps.map((s) => (
              <li
                key={s.id}
                className="flex items-start gap-3 rounded-control border border-line bg-surface p-3"
              >
                <span
                  aria-hidden="true"
                  className={`grid size-10 shrink-0 place-items-center rounded-control ${
                    s.done ? "bg-[var(--lv-accent)] text-white" : "bg-surface-2 text-accent"
                  }`}
                >
                  {s.done ? (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  ) : (
                    <FeatureIcon name={s.icon} />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="m-0 font-semibold">
                    {s.title}
                    {s.done && <span className="sr-only"> (done)</span>}
                  </p>
                  <p className="m-0 text-sm text-muted">{s.why}</p>
                  <div>
                    <Button
                      size="sm"
                      variant={s.done ? "ghost" : "secondary"}
                      onClick={() => go(s)}
                    >
                      {s.go.label}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Good to know" className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-semibold">Good to know</h3>
          <Section title="How marks are worked out">
            <p className="m-0">
              Single best answer and single choice: full mark for the right option, nothing
              otherwise. Multiple answer: each right pick earns a share, and a wrong pick takes one
              back. With 2 right answers, picking both gives 1 and picking one gives 0.5.
            </p>
            <p className="m-0">
              True or false: one lead-in with up to 5 statements. Each statement is worth an equal
              share, so 3 right out of 5 gives 0.6. Statements you leave unmarked score nothing, up
              or down.
            </p>
            <p className="m-0">
              Timed exams can also take marks off for wrong answers. The total never goes below 0.
            </p>
          </Section>
          <Section title="Making questions with AI">
            <ol className="m-0 list-decimal pl-5">
              <li>
                Add questions, then Make a prompt for AI. Fill in subject, topic, exam and tags.
              </li>
              <li>
                Copy the prompt into your AI chat. Attach your notes, or photos of questions you
                want copied.
              </li>
              <li>
                Copy the JSON AI replies with, then paste it into Learivo and check the preview.
              </li>
              <li>
                If some questions are rejected, copy the fix request and send it back to your AI
                chat.
              </li>
            </ol>
            <p className="m-0">
              Learivo does not store pictures. A question that needs a picture is described in words
              and starts with [Picture: so you can find it.
            </p>
          </Section>
          <Section title="Revision and flashcards">
            <p className="m-0">
              Questions you miss or skip are added to revision and turned into flashcards (switch
              this off in Settings). Rate each card Again, Hard, Good or Easy and it comes back
              later or sooner. Flashcards and glossary terms work the same way for facts you write
              yourself.
            </p>
          </Section>
          <Section title="Offline and syncing">
            <p className="m-0">
              Your questions and practice sessions work without internet and sync when you are back
              online. Notes, bookmarks, flashcards and the glossary need an internet connection.
            </p>
          </Section>
          <Section title="Privacy and your data">
            <p className="m-0">
              Everything is private to your account. Nobody else can see your questions. You can
              export everything from Questions, and clear data from Settings.
            </p>
          </Section>
          <Section title="Shortcuts">
            <p className="m-0">
              Press Ctrl K (or Cmd K) to search and jump anywhere. On a phone, tap Search at the
              top.
            </p>
          </Section>
        </section>
      </div>
    </Dialog>
  );
}
