import type { ReactNode } from "react";
import { Button, LogoWordmark, ThemeBackground, ThemeSwitcher } from "../ui-kit/index.ts";
import { ConfidenceMatrix, PaceDemo, PaperPreview, TryQuestion } from "./demos.tsx";
import { Faq, Tour } from "./tour.tsx";
import { SUPPORT_EMAIL } from "../core/support.ts";
import "./landing.css";

interface Props {
  onSignIn: () => void;
  onCreate: () => void;
}

const WRAP = "mx-auto w-full max-w-6xl px-4 sm:px-6";

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`${WRAP} grid gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20`}
    >
      <div className="flex flex-col gap-3 lg:pt-2">
        <h2 id={id} className="lp-h2 m-0">
          {title}
        </h2>
        <p className="m-0 max-w-[34rem] text-base leading-relaxed text-muted sm:text-lg">{lead}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

const TRUST: { title: string; text: string }[] = [
  { title: "Offline", text: "Practise on the train, sync later" },
  { title: "Private", text: "Only you can read your questions" },
  { title: "Your questions", text: "Five question types, your own words" },
  { title: "On your phone", text: "Installs to the home screen" },
];

const FACTS: { title: string; text: string }[] = [
  {
    title: "Works without a connection",
    text: "Practise, edit questions, write notes and organise offline. Changes wait on your phone and are sent when you are back online, and the app tells you what is waiting.",
  },
  {
    title: "Only you can read your data",
    text: "Your questions and results sit in your own account, and the database itself refuses to show them to anyone else. There are no ads and no tracking of what you study.",
  },
  {
    title: "One file holds everything",
    text: "Download all your questions, notes, flashcards and results in one file that Learivo checks for damage, and lock it with a passphrase if you like.",
  },
  {
    title: "Questions in your own words",
    text: "Write single best answer, single choice, multiple select, true or false and fill-in-the-blank questions, with explanations, tags, subjects and colours.",
  },
  {
    title: "Revision that runs itself",
    text: "Every question you miss joins your revision, and flashcards and glossary terms are scheduled for you, so each day starts with what is due.",
  },
];

export default function Landing({ onSignIn, onCreate }: Props) {
  return (
    <>
      <ThemeBackground />
      <header className="lp-bar-top">
        <div className={`${WRAP} flex items-center justify-between gap-3 py-2`}>
          <LogoWordmark size={30} />
          <nav aria-label="Page sections" className="lp-links hidden md:flex">
            <a href="#lp-tour">Tour</a>
            <a href="#lp-pace">Plan</a>
            <a href="#lp-look">Themes</a>
            <a href="#lp-faq">Questions</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onSignIn} className="whitespace-nowrap">
              Sign in
            </Button>
            <span className="hidden sm:inline-flex">
              <Button onClick={onCreate}>Create account</Button>
            </span>
          </div>
        </div>
      </header>

      <main>
        <section
          aria-labelledby="lp-hero"
          className={`${WRAP} grid gap-12 overflow-x-clip pb-16 pt-6 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-14`}
        >
          <div className="flex flex-col gap-6">
            <h1 id="lp-hero" className="lp-h1 m-0">
              Practise the way the exam asks.
            </h1>
            <p className="m-0 max-w-[34rem] text-lg leading-relaxed text-muted">
              Learivo is your private question bank. Practise by topic, revise on a schedule, sit
              timed exams, and see exactly where you lose marks.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={onCreate}>
                Create your account
              </Button>
              <Button size="lg" variant="secondary" onClick={onSignIn}>
                Sign in
              </Button>
            </div>
            <p className="m-0 text-sm text-muted">
              Made for medical exam preparation. Runs in your phone&apos;s browser and installs to
              your home screen.
            </p>
          </div>
          <TryQuestion />
        </section>

        <div className={WRAP}>
          <dl className="lp-trust m-0">
            {TRUST.map((t) => (
              <div key={t.title}>
                <dt className="font-semibold">{t.title}</dt>
                <dd className="m-0 text-sm text-muted">{t.text}</dd>
              </div>
            ))}
          </dl>
        </div>

        <section aria-labelledby="lp-tour" className={`${WRAP} py-14 lg:py-20`}>
          <div className="mb-8 flex max-w-[40rem] flex-col gap-3">
            <h2 id="lp-tour" className="lp-h2 m-0">
              Try the app before you sign up
            </h2>
            <p className="m-0 text-base leading-relaxed text-muted sm:text-lg">
              Four screens you can use here: build a test, sit an exam, find your weak areas and
              revise. They show sample data, and your own questions work the same way.
            </p>
          </div>
          <Tour onCreate={onCreate} />
        </section>

        <div className="border-y border-line bg-surface-2">
          <Section
            id="lp-confidence"
            title="Learn which mistakes cost you the most"
            lead="After each question you say how sure you were. A wrong answer you were sure about says more than a wrong answer you expected, and Learivo keeps them apart."
          >
            <ConfidenceMatrix />
          </Section>
        </div>

        <Section
          id="lp-pace"
          title="Plan backwards from exam day"
          lead="Set your exam date and Learivo works out how many questions a day you need, shows it on Home, and builds a week plan around what is due."
        >
          <PaceDemo />
        </Section>

        <div className="border-y border-line bg-surface-2">
          <Section
            id="lp-paper"
            title="Print a real exam paper"
            lead="Choose questions, a title and time, and get a clean paper with two columns, 12-point text, an answer key on its own page and, if you want, explanations. The same file also works on a phone, where you can tap answers and check them."
          >
            <PaperPreview />
          </Section>
        </div>

        <section aria-labelledby="lp-facts" className={`${WRAP} py-14 lg:py-20`}>
          <h2 id="lp-facts" className="lp-h2 m-0 max-w-[40rem]">
            Built to be trusted with your study
          </h2>
          <dl className="lp-facts m-0 mt-8">
            {FACTS.map((f) => (
              <div key={f.title}>
                <dt className="font-semibold">{f.title}</dt>
                <dd className="m-0 max-w-[40rem] text-muted">{f.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="border-y border-line bg-surface-2">
          <Section
            id="lp-look"
            title="Make it look like yours"
            lead="Three themes, each in light and dark. Try them here. The page changes as you choose."
          >
            <div className="lp-card p-4 sm:p-6">
              <ThemeSwitcher />
            </div>
          </Section>
        </div>

        <section aria-labelledby="lp-faq" className={`${WRAP} py-14 lg:py-20`}>
          <h2 id="lp-faq" className="lp-h2 m-0 mb-6 max-w-[40rem]">
            Questions before you start
          </h2>
          <Faq />
        </section>

        <section
          aria-labelledby="lp-start"
          className={`${WRAP} flex flex-col items-start gap-5 py-16 lg:py-24`}
        >
          <h2 id="lp-start" className="lp-h2 m-0 max-w-[36rem]">
            Your next 20 questions are waiting.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={onCreate}>
              Create your account
            </Button>
            <Button size="lg" variant="secondary" onClick={onSignIn}>
              Sign in
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div
          className={`${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4 text-sm text-muted`}
        >
          <LogoWordmark size={22} />
          <nav aria-label="Legal" className="flex gap-4">
            <a
              className="inline-flex min-h-10 min-w-10 items-center justify-center underline"
              href="/privacy.html"
            >
              Privacy
            </a>
            <a
              className="inline-flex min-h-10 min-w-10 items-center justify-center underline"
              href="/terms.html"
            >
              Terms
            </a>
            <a
              className="inline-flex min-h-10 min-w-10 items-center justify-center underline"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
