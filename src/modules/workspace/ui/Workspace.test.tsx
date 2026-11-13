import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../../../themes/ThemeProvider.tsx";
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

const tf = (stem: string, answer = true, path: string[] = []) => ({
  ...blankQuestion("true_false"),
  stem,
  explanation: `Because ${stem}`,
  answer: { answer },
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
        answer: { answer: true },
        difficulty: null,
        path: x.path ?? [],
      },
    })),
  });
  for (const [i, x] of items.entries())
    await attempts.patchItem(id, i, { response: { value: x.right } });
  await attempts.submit(
    id,
    items.map((x, position) => ({
      position,
      verdict: x.right ? "correct" : "wrong",
      marks: x.right ? 1 : 0,
    })),
    {
      score: items.filter((x) => x.right).length,
      correct: items.filter((x) => x.right).length,
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
      async ({ bank }) => (await bank.create([tf("Only question", true)]))[0]!,
    );
    await waitFor(() => expect(screen.getByText(/question(s)? available/)).toBeTruthy());
    fireEvent.click(await screen.findByRole("button", { name: "Start practice" }));
    await screen.findByText(/Question 1 of 1/);
    fireEvent.click(screen.getByRole("button", { name: "Bookmark" }));
    await waitFor(async () => expect((await workspace.bookmarks()).has(id)).toBe(true));
    fireEvent.click(screen.getByLabelText("False")); // wrong
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
    expect(await screen.findByText("Questions answered")).toBeTruthy();
    const totals = screen.getByRole("region", { name: "Totals" });
    expect(within(totals).getByText("4")).toBeTruthy();
    expect(within(totals).getByText("75%")).toBeTruthy();
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
    expect(saved.order.slice(0, 3)).toEqual(["focus", "goal", "numbers"]);
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
