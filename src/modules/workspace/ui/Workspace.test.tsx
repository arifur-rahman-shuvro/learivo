import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../../../ui-kit/themes/ThemeProvider.tsx";
import { MemoryRepo } from "../../question-bank/data/memoryRepo.ts";
import { BankProvider } from "../../question-bank/ui/bank.tsx";
import { blankQuestion } from "../../question-bank/domain/model.ts";
import { MemoryAttempts } from "../../practice/data/memoryAttempts.ts";
import { PracticeProvider, handoff } from "../../practice/ui/practice.tsx";
import PracticeScreen from "../../practice/ui/PracticeScreen.tsx";
import { MemoryWorkspace } from "../data/memoryWorkspace.ts";
import { WorkspaceProvider } from "./workspace.tsx";
import ReviewScreen from "./ReviewScreen.tsx";
import InsightsScreen from "./InsightsScreen.tsx";
import HomeDashboard from "./HomeDashboard.tsx";
import { TF_ANSWER } from "../../../testing/fixtures.ts";

const tf = (stem: string, path: string[] = []) => ({
  ...blankQuestion("true_false"),
  stem,
  explanation: `Because ${stem}`,
  answer: TF_ANSWER,
  path,
});

interface Stores {
  bank: MemoryRepo;
  attempts: MemoryAttempts;
  workspace: MemoryWorkspace;
}

/** Fills the stores first, then shows the screen, so the screen loads the data on mount. */
async function setup<T = void>(
  ui: (nav: (r: string) => void) => React.ReactNode,
  seed?: (s: Stores) => Promise<T>,
) {
  const stores: Stores = {
    bank: new MemoryRepo(),
    attempts: new MemoryAttempts(),
    workspace: new MemoryWorkspace(),
  };
  const seeded = (seed ? await seed(stores) : undefined) as T;
  const nav = vi.fn();
  render(
    <ThemeProvider>
      <BankProvider repo={stores.bank}>
        <PracticeProvider attempts={stores.attempts}>
          <WorkspaceProvider repo={stores.workspace}>{ui(nav)}</WorkspaceProvider>
        </PracticeProvider>
      </BankProvider>
    </ThemeProvider>,
  );
  return { ...stores, nav, seeded };
}

/** A finished session in which each given question was answered right or wrong. */
async function finished(
  attempts: MemoryAttempts,
  items: { id: string; stem: string; path?: string[]; right: boolean }[],
  kind: "practice" | "exam" = "practice",
) {
  const id = await attempts.create({
    kind,
    examId: null,
    title: kind === "exam" ? "Mock exam" : "Practice session",
    instantFeedback: false,
    timeLimitSec: null,
    marksCorrect: 1,
    marksWrong: 0,
    items: items.map((x) => ({
      questionId: x.id,
      snapshot: {
        qtype: "true_false",
        stem: x.stem,
        explanation: "",
        answer: TF_ANSWER,
        difficulty: null,
        path: x.path ?? [],
      },
    })),
  });
  for (const [i, x] of items.entries())
    await attempts.patchItem(id, i, {
      response: {
        marks: x.right ? [true, false, true, false, false] : [false, true, false, true, true],
      },
    });
  await attempts.submit(
    id,
    items.map((x, position) => ({
      position,
      verdict: x.right ? "correct" : "wrong",
      credit: x.right ? 1 : 0,
      marks: x.right ? 1 : 0,
    })),
    {
      score: items.filter((x) => x.right).length,
      correct: items.filter((x) => x.right).length,
      partial: 0,
      wrong: items.filter((x) => !x.right).length,
      unanswered: 0,
      secondsSpent: 120,
    },
  );
  return id;
}

afterEach(() => {
  cleanup();
  handoff.attemptId = null;
});

describe("Review: due now", () => {
  it("shows a due card, rates it Good, and the queue is then caught up", async () => {
    const { workspace } = await setup(
      (nav) => <ReviewScreen onNavigate={nav} />,
      async ({ bank, workspace }) => {
        const [id] = await bank.create([tf("The heart has four chambers")]);
        await workspace.addCards([id!]);
      },
    );
    fireEvent.click(await screen.findByRole("tab", { name: /Due now/ }));
    expect(await screen.findByText("1 card due")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(await screen.findByText("Explanation")).toBeTruthy();
    const group = screen.getByRole("group", { name: "How well did you remember it?" });
    expect(within(group).getByText("10 min")).toBeTruthy(); // Again
    fireEvent.click(within(group).getByRole("button", { name: /Good/ }));
    expect(await screen.findByText("You are all caught up")).toBeTruthy();
    const [card] = await workspace.cards();
    expect(card).toMatchObject({ state: "review", reps: 1 });
    expect(new Date(card!.due).getTime()).toBeGreaterThan(Date.now() + 86_400_000);
  });

  it("Again keeps the card in the queue soon, not days away", async () => {
    const { workspace } = await setup(
      (nav) => <ReviewScreen onNavigate={nav} />,
      async ({ bank, workspace }) => {
        const [id] = await bank.create([tf("Q")]);
        await workspace.addCards([id!]);
      },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Show answer" }));
    fireEvent.click(await screen.findByRole("button", { name: /Again/ }));
    await screen.findByText("You are all caught up");
    const [card] = await workspace.cards();
    expect(new Date(card!.due).getTime() - Date.now()).toBeLessThan(11 * 60_000);
  });
});

describe("Review: mistakes, bookmarks, notes", () => {
  it("lists mistakes, adds one to revision, and hands a practice session to Practice", async () => {
    const { workspace, nav } = await setup(
      (n) => <ReviewScreen onNavigate={n} />,
      async ({ bank, attempts }) => {
        const [a, b] = await bank.create([tf("Missed one"), tf("Got this right")]);
        await finished(attempts, [
          { id: a!, stem: "Missed one", right: false },
          { id: b!, stem: "Got this right", right: true },
        ]);
      },
    );
    fireEvent.click(await screen.findByRole("tab", { name: /Mistakes/ }));
    expect(await screen.findByText("Missed one")).toBeTruthy();
    expect(screen.queryByText("Got this right")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add to revision" }));
    expect(await screen.findByText("In revision")).toBeTruthy();
    expect(await workspace.cards()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Practise these/ }));
    await waitFor(() => expect(nav).toHaveBeenCalledWith("#/practice"));
    expect(handoff.attemptId).not.toBeNull();
  });

  it("removes a bookmark", async () => {
    const { workspace } = await setup(
      (n) => <ReviewScreen onNavigate={n} />,
      async ({ bank, workspace }) => {
        const [id] = await bank.create([tf("Saved question")]);
        await workspace.setBookmark(id!, true);
      },
    );
    fireEvent.click(await screen.findByRole("tab", { name: /Bookmarks/ }));
    expect(await screen.findByText("Saved question")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove bookmark" }));
    expect(await screen.findByText("No bookmarks yet")).toBeTruthy();
    expect((await workspace.bookmarks()).size).toBe(0);
  });

  it("writes a free note and refuses an empty one", async () => {
    await setup((n) => <ReviewScreen onNavigate={n} />);
    fireEvent.click(await screen.findByRole("tab", { name: /Notes/ }));
    fireEvent.click((await screen.findAllByRole("button", { name: "New note" }))[0]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save note" }));
    expect(await within(dialog).findByText("Write something in the note.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Title (optional)"), {
      target: { value: "Drug list" },
    });
    fireEvent.change(within(dialog).getByLabelText("Note"), {
      target: { value: "Warfarin, heparin" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save note" }));
    expect(await screen.findByText("Drug list")).toBeTruthy();
    expect(screen.getByText("Warfarin, heparin")).toBeTruthy();
  });
});

describe("Practice with the workspace", () => {
  it("bookmarks a question while practising, and a wrong answer joins revision", async () => {
    const { workspace, seeded: id } = await setup(
      () => <PracticeScreen />,
      async ({ bank }) => (await bank.create([tf("Only question")]))[0]!,
    );
    await waitFor(() => expect(screen.getByText(/question(s)? available/)).toBeTruthy());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    await screen.findByText(/Question 1 of 1/);
    fireEvent.click(screen.getByRole("button", { name: "Bookmark" }));
    await waitFor(async () => expect((await workspace.bookmarks()).has(id)).toBe(true));
    fireEvent.click(screen.getAllByLabelText("False")[0]!); // statement 1 is True, so this is wrong
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }),
    );
    await screen.findByRole("heading", { name: "Results" });
    expect((await workspace.cards()).map((c) => c.questionId)).toEqual([id]);
  });
});

describe("Insights", () => {
  it("shows an empty state before any session", async () => {
    await setup((n) => <InsightsScreen onNavigate={n} />);
    expect(await screen.findByText("Nothing to show yet")).toBeTruthy();
  });

  it("starts a practice session from a weak area", async () => {
    const { nav } = await setup(
      (n) => <InsightsScreen onNavigate={n} />,
      async ({ bank, attempts }) => {
        const [a, b] = await bank.create([
          { ...tf("A1"), path: ["Anatomy"] },
          { ...tf("A2"), path: ["Anatomy"] },
        ]);
        await finished(attempts, [
          { id: a!, stem: "A1", path: ["Anatomy"], right: false },
          { id: b!, stem: "A2", path: ["Anatomy"], right: false },
        ]);
      },
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Subjects" }));
    fireEvent.click(await screen.findByRole("button", { name: "Practise Anatomy" }));
    await waitFor(() => expect(nav).toHaveBeenCalledWith("#/practice"));
    expect(handoff.attemptId).not.toBeNull();
  });

  it("says there are too few answers for a readiness estimate, and still suggests where to practise", async () => {
    await setup(
      (n) => <InsightsScreen onNavigate={n} />,
      async ({ bank, attempts }) => {
        const [a, c] = await bank.create([tf("A1"), tf("P1")]);
        await finished(attempts, [
          { id: a!, stem: "A1", path: ["Anatomy"], right: false },
          { id: c!, stem: "P1", path: ["Physiology"], right: true },
        ]);
      },
    );
    const card = await screen.findByRole("region", { name: "Readiness" });
    expect(within(card).getByText(/Not enough answers yet for an estimate/)).toBeTruthy();
    expect(within(card).getByText(/Where to spend your next 20 questions/)).toBeTruthy();
    expect(within(card).getAllByText(/Only 1 answer so far/).length).toBe(2);
  });

  it("starts practice for an area straight from the plan", async () => {
    const { nav } = await setup(
      (n) => <InsightsScreen onNavigate={n} />,
      async ({ bank, attempts }) => {
        const [a, b] = await bank.create([
          { ...tf("A1"), path: ["Anatomy"] },
          { ...tf("A2"), path: ["Anatomy"] },
        ]);
        await finished(attempts, [
          { id: a!, stem: "A1", path: ["Anatomy"], right: false },
          { id: b!, stem: "A2", path: ["Anatomy"], right: false },
        ]);
      },
    );
    const card = await screen.findByRole("region", { name: "Readiness" });
    fireEvent.click(within(card).getByRole("button", { name: "Practise Anatomy" }));
    await waitFor(() => expect(nav).toHaveBeenCalledWith("#/practice"));
  });

  it("sizes the plan from the daily goal and raises it when the exam is close", async () => {
    const soon = new Date(Date.now() + 5 * 86_400_000);
    const date = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
    await setup(
      (n) => <InsightsScreen onNavigate={n} />,
      async ({ bank, attempts, workspace }) => {
        await workspace.setDailyGoal(20);
        await workspace.setExamTarget({ title: "Finals", date });
        const [a, c] = await bank.create([tf("A1"), tf("P1")]);
        await finished(attempts, [
          { id: a!, stem: "A1", path: ["Anatomy"], right: false },
          { id: c!, stem: "P1", path: ["Physiology"], right: true },
        ]);
      },
    );
    const card = await screen.findByRole("region", { name: "Readiness" });
    expect(await within(card).findByText(/Where to spend your next 30 questions/)).toBeTruthy();
    expect(within(card).getByText(/half more than your daily goal of 20/)).toBeTruthy();
  });

  it("shows a readiness estimate with its range once there are enough answers", async () => {
    await setup(
      (n) => <InsightsScreen onNavigate={n} />,
      async ({ bank, attempts }) => {
        const ids = await bank.create(Array.from({ length: 24 }, (_, i) => tf(`Q${i}`)));
        await finished(
          attempts,
          ids.map((id, i) => ({ id, stem: `Q${i}`, path: ["Anatomy"], right: i % 4 !== 0 })),
        );
      },
    );
    const card = await screen.findByRole("region", { name: "Readiness" });
    expect(within(card).getByText(/likely range/)).toBeTruthy();
    expect(within(card).getByText(/not a prediction of your exam mark/)).toBeTruthy();
    expect(within(card).getAllByText(/24 answers/).length).toBeGreaterThan(0);
  });

  it("shows totals, weakest subject first, and exam scores", async () => {
    await setup(
      (n) => <InsightsScreen onNavigate={n} />,
      async ({ bank, attempts }) => {
        const [a, b, c] = await bank.create([tf("A1"), tf("A2"), tf("P1")]);
        await finished(attempts, [
          { id: a!, stem: "A1", path: ["Anatomy"], right: false },
          { id: b!, stem: "A2", path: ["Anatomy"], right: true },
          { id: c!, stem: "P1", path: ["Physiology"], right: true },
        ]);
        await finished(attempts, [{ id: a!, stem: "A1", path: ["Anatomy"], right: true }], "exam");
      },
    );
    const summary = await screen.findByRole("region", { name: "Summary" });
    expect(within(summary).getAllByText("75%").length).toBeGreaterThan(0);
    expect(within(summary).getByText(/3 right of 4 answered, over 2 sessions/)).toBeTruthy();
    expect(within(summary).getByText(/1-day streak/)).toBeTruthy();
    expect(screen.getByRole("img", { name: /Answers per day over the last 84 days/ })).toBeTruthy();
    const why = screen.getByRole("region", { name: "Why you lose marks" });
    expect(within(why).getByText(/1 missed question/)).toBeTruthy();
    expect(screen.getByRole("img", { name: /Accuracy by day/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Subjects" }));
    const bars = await screen.findAllByRole("progressbar");
    expect(bars[0]!.getAttribute("aria-label")).toBe("Anatomy accuracy"); // 2 of 3 is weaker than 1 of 1
    fireEvent.click(screen.getByRole("tab", { name: "Exams" }));
    expect(await screen.findByRole("img", { name: /Exam scores/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Study time" }));
    expect(await screen.findByText(/Total: 04:00 across 2 sessions/)).toBeTruthy();
  });
});

describe("Home dashboard", () => {
  it("shows the starter page when the bank is empty", async () => {
    await setup((n) => <HomeDashboard onNavigate={n} />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Your question bank starts here" }),
    ).toBeTruthy();
  });

  it("shows due cards, today's progress and lets the student change the goal", async () => {
    const { workspace, nav } = await setup(
      (n) => <HomeDashboard onNavigate={n} />,
      async ({ bank, attempts, workspace }) => {
        const [a, b] = await bank.create([tf("Q1"), tf("Q2")]);
        await workspace.addCards([a!, b!]);
        await finished(attempts, [
          { id: a!, stem: "Q1", right: true },
          { id: b!, stem: "Q2", right: false },
        ]);
      },
    );
    expect(await screen.findByText("2 cards due for revision")).toBeTruthy();
    expect(await screen.findByText("2 of 20 questions today.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start revision" }));
    expect(nav).toHaveBeenCalledWith("#/review");
    fireEvent.click(screen.getByRole("button", { name: "Change goal" }));
    fireEvent.change(screen.getByLabelText("Questions per day"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save goal" }));
    expect(await screen.findByText("2 of 40 questions today.")).toBeTruthy();
    expect(await workspace.dailyGoal()).toBe(40);
  });

  it("refuses a goal outside 1 to 500", async () => {
    await setup(
      (n) => <HomeDashboard onNavigate={n} />,
      async ({ bank }) => {
        await bank.create([tf("Q1")]);
      },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Change goal" }));
    fireEvent.change(screen.getByLabelText("Questions per day"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save goal" }));
    expect(await screen.findByText("Choose a goal from 1 to 500.")).toBeTruthy();
  });

  it("lets the student hide and reorder sections, and keeps the choice", async () => {
    const { workspace } = await setup(
      (n) => <HomeDashboard onNavigate={n} />,
      async ({ bank }) => {
        await bank.create([tf("Q1")]);
      },
    );
    expect(await screen.findByRole("heading", { name: "Daily goal" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Weak areas" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    const dialog = await screen.findByRole("dialog", { name: "Customize Home" });
    const weak = within(dialog).getByRole("checkbox", { name: "Weak areas" });
    fireEvent.click(weak);
    fireEvent.click(within(dialog).getByRole("button", { name: "Move Daily goal up" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save layout" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Weak areas" })).toBeNull());
    const saved = await workspace.homeLayout();
    expect(saved.hidden).toEqual(["weak"]);
    expect(saved.order.slice(0, 4)).toEqual(["focus", "numbers", "goal", "features"]);
  });

  it("can reset the layout and does not save when cancelled", async () => {
    const { workspace } = await setup(
      (n) => <HomeDashboard onNavigate={n} />,
      async ({ bank, workspace }) => {
        await bank.create([tf("Q1")]);
        await workspace.setHomeLayout({
          order: ["recent", "weak", "goal", "numbers", "focus"],
          hidden: ["goal"],
        });
      },
    );
    await screen.findByRole("heading", { name: "Weak areas" });
    expect(screen.queryByRole("heading", { name: "Daily goal" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    const dialog = await screen.findByRole("dialog", { name: "Customize Home" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect((await workspace.homeLayout()).hidden).toEqual(["goal"]);
  });
});

describe("Review: notes search", () => {
  it("filters notes by title, body or question text", async () => {
    await setup(
      (nav) => <ReviewScreen onNavigate={nav} />,
      async ({ workspace }) => {
        await workspace.saveNote({
          id: null,
          questionId: null,
          title: "Cardiac",
          body: "**Pumps** blood",
        });
        await workspace.saveNote({
          id: null,
          questionId: null,
          title: "Renal",
          body: "Filters blood",
        });
      },
    );
    fireEvent.click(await screen.findByRole("tab", { name: /Notes/ }));
    expect(await screen.findByText("Cardiac")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "renal" } });
    expect(screen.queryByText("Cardiac")).toBeNull();
    expect(screen.getByText("Renal")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "zzz" } });
    expect(screen.getByText(/No notes match/)).toBeTruthy();
  });
});

describe("Home: exam countdown", () => {
  it("sets an exam date, shows the days left and lets it be removed", async () => {
    const { workspace } = await setup(
      () => <HomeDashboard onNavigate={() => undefined} />,
      async ({ bank }) => {
        await bank.create([tf("Q1"), tf("Q2")]);
      },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Set exam date" }));
    fireEvent.change(screen.getByLabelText("Exam name"), { target: { value: "Final MBBS" } });
    const soon = new Date(Date.now() + 10 * 86_400_000);
    const iso = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
    fireEvent.change(screen.getByLabelText("Exam date"), { target: { value: iso } });
    fireEvent.click(screen.getByRole("button", { name: "Save exam" }));
    expect(await screen.findByText("10 days")).toBeTruthy();
    expect(screen.getByText(/until Final MBBS/)).toBeTruthy();
    expect(
      screen.getByText(/2 of your 2 questions are not practised yet. About 1 a day/),
    ).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "Questions practised at least once" }),
    ).toBeTruthy();
    expect((await workspace.examTarget()).date).toBe(iso);
    fireEvent.click(screen.getByRole("button", { name: "Remove exam" }));
    expect(await screen.findByRole("button", { name: "Set exam date" })).toBeTruthy();
  });
});

describe("Insights: achievements", () => {
  it("shows earned and locked milestones from the student's own sessions", async () => {
    await setup(
      (n) => <InsightsScreen onNavigate={n} />,
      async ({ bank, attempts }) => {
        const [a] = await bank.create([tf("A1")]);
        await finished(attempts, [{ id: a!, stem: "A1", right: true }], "exam");
      },
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Achievements" }));
    const list = await screen.findByRole("region", { name: "Achievements" });
    const first = within(list).getByText("First step").closest("li")!;
    expect(within(first).getByText("Earned")).toBeTruthy();
    const exam = within(list).getByText("First exam").closest("li")!;
    expect(within(exam).getByText("Earned")).toBeTruthy();
    const hundred = within(list).getByText("Hundred").closest("li")!;
    expect(within(hundred).getByText("Locked")).toBeTruthy();
    expect(within(hundred).getByRole("progressbar").getAttribute("aria-label")).toBe(
      "Hundred: 1 of 100",
    );
  });
});

describe("Review: flashcards", () => {
  it("writes a card, studies it, rates it, then edits and deletes it", async () => {
    const { workspace } = await setup((n) => <ReviewScreen onNavigate={n} />);
    fireEvent.click(await screen.findByRole("tab", { name: /Flashcards/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Write your first card" }));
    fireEvent.click(screen.getByRole("button", { name: "Save card" }));
    expect(await screen.findByText("Write the front of the card.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Front"), { target: { value: "Heart chambers?" } });
    fireEvent.change(screen.getByLabelText("Back"), { target: { value: "**Four**" } });
    fireEvent.click(screen.getByRole("button", { name: "Save card" }));

    const study = await screen.findByRole("region", { name: "Flashcard" });
    expect(within(study).getByText("Heart chambers?")).toBeTruthy();
    expect(within(study).queryByText("Four")).toBeNull();
    fireEvent.click(within(study).getByRole("button", { name: "Show answer" }));
    expect(within(study).getByText("Four").tagName).toBe("STRONG");
    fireEvent.click(within(study).getByRole("button", { name: /^Good/ }));
    await screen.findByText("No cards due");
    const [saved] = await workspace.flashcards();
    expect(saved!.reps).toBe(1);
    expect(new Date(saved!.due).getTime()).toBeGreaterThan(Date.now());

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Front"), {
      target: { value: "Chambers of the heart?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save card" }));
    expect(await screen.findByText("Chambers of the heart?")).toBeTruthy();
    expect((await workspace.flashcards())[0]!.reps).toBe(1); // editing keeps the schedule

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete card" }));
    expect(await screen.findByText("No flashcards yet")).toBeTruthy();
  });
});

describe("Review: glossary", () => {
  it("adds, searches, refuses a duplicate, and underlines terms in notes", async () => {
    const { workspace } = await setup(
      (n) => <ReviewScreen onNavigate={n} />,
      async ({ workspace }) => {
        await workspace.saveNote({
          id: null,
          questionId: null,
          title: "Cardio",
          body: "Systole is the pumping phase",
        });
      },
    );
    fireEvent.click(await screen.findByRole("tab", { name: /Glossary/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Add your first term" }));
    fireEvent.change(screen.getByLabelText("Term"), { target: { value: "Systole" } });
    fireEvent.change(screen.getByLabelText("Meaning"), { target: { value: "Contraction phase" } });
    fireEvent.click(screen.getByRole("button", { name: "Save term" }));
    expect(await screen.findByText("Contraction phase")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "New term" }));
    fireEvent.change(screen.getByLabelText("Term"), { target: { value: "  systole " } });
    fireEvent.change(screen.getByLabelText("Meaning"), { target: { value: "again" } });
    fireEvent.click(screen.getByRole("button", { name: "Save term" }));
    expect(await screen.findByText("You already have a term with that name.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await workspace.glossary()).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Search glossary"), { target: { value: "zzz" } });
    expect(screen.getByText(/No terms match/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search glossary"), {
      target: { value: "contraction" },
    });
    expect(screen.getByText("Systole")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Notes/ }));
    const hit = await screen.findByTitle("Contraction phase");
    expect(hit.textContent).toBe("Systole");
  });
});

describe("Home week chart", () => {
  it("shows the last seven days and the goal", async () => {
    const { WeekBars } = await import("./InsightsParts.tsx");
    const days = Array.from({ length: 7 }, (_, i) => ({
      day: `2026-11-${String(10 + i).padStart(2, "0")}`,
      count: i === 6 ? 12 : i === 4 ? 3 : 0,
    }));
    render(<WeekBars days={days} goal={10} />);
    const chart = screen.getByRole("img", { name: /Answers in the last 7 days/ });
    expect(chart.getAttribute("aria-label")).toContain("Daily goal 10");
    expect(chart.getAttribute("aria-label")).toContain("Sat 3");
    expect(
      screen.getByText("15 answered in 7 days. The dashed line is your daily goal."),
    ).toBeTruthy();
    cleanup();
    render(<WeekBars days={days.map((d) => ({ ...d, count: 0 }))} goal={10} />);
    expect(screen.getByText(/No answers yet this week/)).toBeTruthy();
  });
});

describe("Home: sample questions", () => {
  it("adds sample questions from the welcome screen and then shows the dashboard", async () => {
    const { bank } = await setup(() => <HomeDashboard onNavigate={() => undefined} />);
    fireEvent.click(await screen.findByRole("button", { name: "Try sample questions" }));
    expect(await screen.findByText("Questions")).toBeTruthy();
    await waitFor(async () => expect(await bank.exportAll()).toHaveLength(5));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Try sample questions" })).toBeNull(),
    );
  });
});

describe("Home: backup reminder", () => {
  it("nudges once there are enough questions, and Later hides it", async () => {
    localStorage.clear();
    await setup(
      () => <HomeDashboard onNavigate={() => undefined} />,
      async ({ bank }) => {
        await bank.create(Array.from({ length: 10 }, (_, i) => tf(`Reminder ${i}`)));
      },
    );
    const note = await screen.findByRole("region", { name: "Backup reminder" });
    fireEvent.click(within(note).getByRole("button", { name: "Later" }));
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Backup reminder" })).toBeNull(),
    );
    expect(localStorage.getItem("learivo.backupLater")).not.toBeNull();
    localStorage.clear();
  });
});
