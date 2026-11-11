import { useState } from "react";
import {
  BottomNav,
  Badge,
  Button,
  Card,
  CheckIcon,
  EmptyState,
  Field,
  LogoMark,
  LogoWordmark,
  PlusIcon,
  ProgressBar,
  ProgressRing,
  Spinner,
  ThemeBackground,
  ThemeSwitcher,
} from "./design-system/index.ts";
import { getTokens } from "./themes/registry.ts";
import { useTheme } from "./themes/ThemeProvider.tsx";

/** Design Lab: every core component, live in the active theme. Not a product screen. */
export default function App() {
  const { theme, mode } = useTheme();
  const colors = getTokens(theme, mode).colors;
  const [email, setEmail] = useState("");
  const emailError = email.length > 0 && !email.includes("@") ? "Enter a valid email address." : undefined;

  return (
    <>
      <ThemeBackground />
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-28 pt-5 sm:px-6">
        <header className="flex items-center justify-between">
          <LogoWordmark />
          <Badge tone="accent">Design Lab · Phase 2</Badge>
        </header>

        <section aria-labelledby="h-intro" className="flex flex-col gap-2">
          <h1 id="h-intro" className="text-3xl font-bold sm:text-4xl">
            One design system, three worlds
          </h1>
          <p className="max-w-2xl text-muted">
            Every component below reads only design tokens. Switch theme or mode and the surfaces, type, depth, motion and
            illustrations change together.
          </p>
        </section>

        <Card className="p-5">
          <ThemeSwitcher />
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-xl font-semibold">Buttons</h2>
            <div className="flex flex-wrap gap-3">
              <Button icon={<PlusIcon size={18} />}>Add question</Button>
              <Button variant="secondary">Cancel</Button>
              <Button variant="ghost">Skip</Button>
              <Button variant="danger">Delete</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button loading>Saving</Button>
              <Button disabled>Disabled</Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-xl font-semibold">Form field</h2>
            <Field
              label="Email"
              type="text"
              placeholder="you@example.com"
              hint="We never share your email."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
            />
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge tone="success">Correct</Badge>
              <Badge tone="warning">Review</Badge>
              <Badge tone="danger">Incorrect</Badge>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-xl font-semibold">Progress</h2>
            <div className="flex items-center gap-5">
              <ProgressRing value={72} label="Accuracy" />
              <div className="flex flex-1 flex-col gap-3">
                <div>
                  <p className="mb-1 text-sm text-muted">Anatomy</p>
                  <ProgressBar value={84} label="Anatomy progress" />
                </div>
                <div>
                  <p className="mb-1 text-sm text-muted">Physiology</p>
                  <ProgressBar value={46} label="Physiology progress" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-muted">
              <Spinner /> <span>Loading indicator</span>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-5" interactive>
            <h2 className="text-xl font-semibold">Interactive card</h2>
            <p className="text-muted">Lifts on hover on devices with a pointer. Raised surfaces use the theme shadow recipe.</p>
            <div className="flex items-center gap-2 text-success">
              <CheckIcon size={18} /> <span className="font-semibold">12 questions due today</span>
            </div>
          </Card>
        </div>

        <Card className="p-2">
          <EmptyState
            title="No questions yet"
            description="Create your first question or import a JSON or CSV file to start your private bank."
            action={<Button icon={<PlusIcon size={18} />}>Add question</Button>}
          />
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-xl font-semibold">Colour tokens · {theme.name} · {mode}</h2>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
            {Object.entries(colors).map(([name, value]) => (
              <li key={name} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-control border border-line-strong" style={{ background: value }} />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex items-center gap-3 text-muted">
          <LogoMark size={40} tile title="Learivo app icon" /> <span>App icon tile</span>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <BottomNav />
      </div>
    </>
  );
}
