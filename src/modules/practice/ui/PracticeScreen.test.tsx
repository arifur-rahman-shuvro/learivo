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

/** A single-best-answer question with five options; "Right answer" is the key. */
const tf = (stem: string): QuestionInput => ({
  ...blankQuestion("sba"),
  stem,
  explanation: `Because ${stem}`,
  answer: {
    options: [
      { text: "Right answer", correct: true },
      { text: "Wrong answer 1", correct: false },
      { text: "Wrong answer 2", correct: false },
      { text: "Wrong answer 3", correct: false },
      { text: "Wrong answer 4", correct: false },
    ],
  },
});

function setup(questions = [tf("Q one"), tf("Q two"), tf("Q three")]) {
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
    // First question appears; pick the right answer, then check it.
    await screen.findByText(/Question 1 of 3/);
    fireEvent.click(screen.getByLabelText(/Right answer/));
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
    const { ready, attempts } = setup([tf("Only question")]);
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
    fireEvent.click(screen.getByLabelText(/Wrong answer 1/));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }),
    );
    await screen.findByRole("heading", { name: "Results" });
    const [done] = await attempts.list(1);
    // One wrong answer with 0.5 lost can never take the score below zero.
    expect(done).toMatchObject({ kind: "exam", wrong: 1, score: 0 });
  });

  it("lets the student tag why a wrong answer was missed, and clear it", async () => {
    const { ready, attempts } = setup([tf("Tag me")]);
    await ready;
    await startPractice(1);
    await screen.findByText(/Question 1 of 1/);
    fireEvent.click(screen.getByLabelText(/Wrong answer 1/));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }),
    );
    await screen.findByRole("heading", { name: "Results" });
    fireEvent.click(screen.getByRole("button", { name: /Tag me/ }));
    const careless = await screen.findByRole("radio", { name: "Careless" });
    fireEvent.click(careless);
    await waitFor(async () => {
      const [a] = await attempts.list(1);
      const full = await attempts.get(a!.id);
      expect(full!.items[0]!.mistakeReason).toBe("careless");
    });
    expect(careless.getAttribute("aria-checked")).toBe("true");
    const facts = await attempts.facts(10);
    expect(facts[0]!.reason).toBe("careless");
    fireEvent.click(careless);
    await waitFor(async () => {
      const [a] = await attempts.list(1);
      expect((await attempts.get(a!.id))!.items[0]!.mistakeReason).toBeNull();
    });
  });

  it("offers to resume an unfinished session and can retry missed questions", async () => {
    const { ready, attempts } = setup([tf("Retry me")]);
    await ready;
    await startPractice(1);
    await screen.findByText(/Question 1 of 1/);
    fireEvent.click(screen.getByLabelText(/Wrong answer 1/)); // wrong
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

  it("marks a true/false question statement by statement: 3 of 5 right earns 0.6", async () => {
    const stmt = (text: string, correct: boolean) => ({ text, correct });
    const heart: QuestionInput = {
      ...blankQuestion("true_false"),
      stem: "Heart has-",
      answer: {
        options: [
          stmt("5 chambers", false),
          stmt("Pumps blood", true),
          stmt("Is 2 in number", false),
          stmt("Has valves", true),
          stmt("Is a bone", false),
        ],
      },
    };
    const { ready, attempts } = setup([heart]);
    await ready;
    await startPractice(1);
    await screen.findByText(/Question 1 of 1/);
    const statements = screen.getAllByRole("group");
    expect(statements).toHaveLength(5);
    // statements 1, 2 and 3 are answered correctly; 4 and 5 are left alone
    fireEvent.click(within(statements[0]!).getByLabelText("False"));
    fireEvent.click(within(statements[1]!).getByLabelText("True"));
    fireEvent.click(within(statements[2]!).getByLabelText("False"));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }),
    );
    await screen.findByRole("heading", { name: "Results" });
    const [done] = await attempts.list(1);
    expect(done).toMatchObject({ partial: 1, correct: 0, wrong: 0, score: 0.6 });
    const summary = screen.getByRole("region", { name: "Summary" });
    expect(within(summary).getByText("Partly correct").nextSibling?.textContent).toBe("1");
    expect(within(summary).getByText("Score").nextSibling?.textContent).toBe("0.6 / 1");
  });

  it("prints a paper from a saved exam", async () => {
    const { ready } = setup([tf("Paper Q one"), tf("Paper Q two")]);
    await ready;
    fireEvent.click(
      (await screen.findAllByRole("button", { name: /New exam|Create an exam/ }))[0]!,
    );
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Mock 2" } });
    fireEvent.change(screen.getByLabelText("Number of questions for rule 1"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save exam" }));
    fireEvent.click(await screen.findByRole("button", { name: "Print paper" }));
    const dlg = await screen.findByRole("dialog", { name: "Print the exam paper" });
    const frame = (await within(dlg).findByTitle("Paper preview")) as HTMLIFrameElement;
    const html = frame.getAttribute("srcdoc") ?? "";
    expect(html).toContain("Mock 2");
    expect(html).toContain("Section A: Single best answer");
    expect(html).toContain("Paper Q one");
    expect(html).toContain("Answer key");
    fireEvent.click(within(dlg).getByLabelText("Add an answer key on the last page"));
    await waitFor(() => expect(frame.getAttribute("srcdoc")).not.toContain("Answer key"));
  });

  describe("focus mode", () => {
    it("shows progress, opens the question list as a sheet, and moves with keys", async () => {
      const { ready } = setup();
      await ready;
      await startPractice();
      await screen.findByText(/Question 1 of 3/);
      expect(screen.getByRole("progressbar", { name: "0 of 3 answered" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Questions" }));
      const sheet = await screen.findByRole("dialog", { name: "Questions" });
      fireEvent.click(within(sheet).getByRole("button", { name: "Question 3" }));
      await screen.findByText(/Question 3 of 3/);
      fireEvent.keyDown(window, { key: "p" });
      await screen.findByText(/Question 2 of 3/);
      fireEvent.keyDown(window, { key: "ArrowRight" });
      await screen.findByText(/Question 3 of 3/);
      fireEvent.keyDown(window, { key: "f" });
      await waitFor(() => expect(screen.getByRole("button", { name: "Remove flag" })).toBeTruthy());
    });

    it("asks the shell to hide the tab bar while a session is open", async () => {
      const { ready } = setup();
      await ready;
      const { useFocusMode } = await import("../../../app/focus.ts");
      let seen = false;
      function Probe() {
        seen = useFocusMode();
        return null;
      }
      render(<Probe />);
      expect(seen).toBe(false);
      await startPractice();
      await screen.findByText(/Question 1 of 3/);
      await waitFor(() => expect(seen).toBe(true));
    });
  });

  describe("quick start", () => {
    it("starts a ten-question session in one tap", async () => {
      const { ready } = setup();
      await ready;
      const btn = await screen.findByRole("button", { name: /^Quick 10/ });
      await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(btn);
      await screen.findByText(/Question 1 of 3/); // the sample bank holds three questions
    });

    it("disables a preset when nothing matches and says so", async () => {
      const { ready } = setup();
      await ready;
      const mistakes = await screen.findByRole("button", { name: /^My mistakes, 0 available/ });
      expect((mistakes as HTMLButtonElement).disabled).toBe(true);
      expect(within(mistakes).getByText("None yet")).toBeTruthy();
    });

    it("remembers the last custom choices", async () => {
      localStorage.clear();
      const { ready } = setup();
      await ready;
      await startPractice(2);
      await screen.findByText(/Question 1 of 2/);
      expect(JSON.parse(localStorage.getItem("learivo.practiceSetup") ?? "{}").count).toBe(2);
      localStorage.clear();
    });
  });
});
