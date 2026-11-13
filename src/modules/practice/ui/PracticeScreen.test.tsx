import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../../../themes/ThemeProvider.tsx";
import { MemoryRepo } from "../../question-bank/data/memoryRepo.ts";
import { BankProvider } from "../../question-bank/ui/bank.tsx";
import { blankQuestion, type QuestionInput } from "../../question-bank/domain/model.ts";
import { MemoryAttempts } from "../data/memoryAttempts.ts";
import PracticeScreen from "./PracticeScreen.tsx";
import { PracticeProvider } from "./practice.tsx";
import { MemoryWorkspace } from "../../workspace/data/memoryWorkspace.ts";
import { WorkspaceProvider } from "../../workspace/ui/workspace.tsx";

const tf = (stem: string, answer: boolean): QuestionInput => ({
  ...blankQuestion("true_false"),
  stem,
  explanation: `Because ${stem}`,
  answer: { answer },
});

function setup(questions = [tf("Q one", true), tf("Q two", false), tf("Q three", true)]) {
  const bank = new MemoryRepo();
  const attempts = new MemoryAttempts();
  const workspace = new MemoryWorkspace();
  const ready = bank.create(questions);
  render(
    <ThemeProvider>
      <BankProvider repo={bank}>
        <PracticeProvider attempts={attempts}>
          <WorkspaceProvider repo={workspace}>
            <PracticeScreen />
          </WorkspaceProvider>
        </PracticeProvider>
      </BankProvider>
    </ThemeProvider>,
  );
  return { bank, attempts, workspace, ready };
}

afterEach(cleanup);

async function startPractice(count = 3) {
  const input = await screen.findByLabelText("Number of questions");
  await waitFor(() => expect(screen.getByText(/question(s)? available/)).toBeTruthy());
  fireEvent.change(input, { target: { value: String(count) } });
  fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
}

describe("Practice", () => {
  it("shows how many questions are available and disables start when there are none", async () => {
    setup([]);
    expect(await screen.findByText("No questions match these choices.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Start practice" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("runs a session: answer, check, submit, and see the results", async () => {
    const { ready } = setup();
    await ready;
    await startPractice();
    // First question appears; answer True, then check it.
    await screen.findByText(/Question 1 of 3/);
    fireEvent.click(screen.getByLabelText("True"));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(await screen.findByText("Explanation")).toBeTruthy();
    // Submit with the rest unanswered.
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/2 questions are not answered/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("heading", { name: "Results" })).toBeTruthy();
    // One answered, two skipped: accuracy is based on answered questions only.
    const summary = screen.getByRole("region", { name: "Summary" });
    expect(within(summary).getByText("Skipped").nextSibling?.textContent).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByText(/correct ·/)).toBeTruthy();
  });

  it("builds an exam, sits it with negative marking and shows the score", async () => {
    const { ready, attempts } = setup([tf("Only question", true)]);
    await ready;
    fireEvent.click(
      (await screen.findAllByRole("button", { name: /New exam|Create an exam/ }))[0]!,
    );
    const title = await screen.findByLabelText("Title");
    fireEvent.change(title, { target: { value: "Mock 1" } });
    fireEvent.change(screen.getByLabelText("Number of questions for rule 1"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Marks lost per wrong answer"), {
      target: { value: "0.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save exam" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start exam" }));
    await screen.findByText(/Question 1 of 1/);
    // Exams give no feedback while sitting: there is no Check answer button.
    expect(screen.queryByRole("button", { name: "Check answer" })).toBeNull();
    fireEvent.click(screen.getByLabelText("False"));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }),
    );
    await screen.findByRole("heading", { name: "Results" });
    const [done] = await attempts.list(1);
    // One wrong answer with 0.5 lost can never take the score below zero.
    expect(done).toMatchObject({ kind: "exam", wrong: 1, score: 0 });
  });

  it("offers to resume an unfinished session and can retry missed questions", async () => {
    const { ready, attempts } = setup([tf("Retry me", true)]);
    await ready;
    await startPractice(1);
    await screen.findByText(/Question 1 of 1/);
    fireEvent.click(screen.getByLabelText("False")); // wrong
    fireEvent.click(screen.getByRole("button", { name: "Save and leave" }));
    expect(await screen.findByText("Continue where you left off")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await screen.findByText(/Question 1 of 1/);
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Practice missed questions" }));
    await screen.findByText(/Question 1 of 1/);
    const list = await attempts.list(5);
    expect(list.map((a) => a.title)).toContain("Retry: missed questions");
    // The history now knows this question was last answered wrong.
    expect([...(await attempts.past()).values()][0]).toEqual({ last: "wrong", times: 1 });
  });
});
