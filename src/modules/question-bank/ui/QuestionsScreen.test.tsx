import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "../../../themes/ThemeProvider.tsx";
import { MemoryRepo } from "../data/memoryRepo.ts";
import { DEFAULT_QUERY } from "../data/repo.ts";
import { BankProvider } from "./bank.tsx";
import QuestionsScreen from "./QuestionsScreen.tsx";
import { MemoryWorkspace } from "../../workspace/data/memoryWorkspace.ts";
import { WorkspaceProvider } from "../../workspace/ui/workspace.tsx";
import { sendIntent } from "../../../app/intents.ts";
import { blankQuestion, type QuestionInput } from "../domain/model.ts";

function tf(stem: string): QuestionInput {
  return { ...blankQuestion("true_false"), stem, answer: { answer: true } };
}

function renderScreen(repo: MemoryRepo) {
  return render(
    <ThemeProvider>
      <BankProvider repo={repo}>
        <WorkspaceProvider repo={new MemoryWorkspace()}>
          <QuestionsScreen />
        </WorkspaceProvider>
      </BankProvider>
    </ThemeProvider>,
  );
}

afterEach(cleanup);

describe("QuestionsScreen", () => {
  it("deletes selected questions straight from the list, after typing DELETE", async () => {
    const repo = new MemoryRepo();
    await repo.create([tf("Delete me"), tf("Keep me")]);
    renderScreen(repo);
    fireEvent.click(await screen.findByLabelText(/Select: Delete me/));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("button", { name: "Delete 1 question" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByText("Delete me")).toBeNull());
    expect(screen.getByText("Keep me")).toBeTruthy();
    expect((await repo.list({ ...DEFAULT_QUERY })).total).toBe(1);
  });

  it("opens with the search or form the command palette asked for", async () => {
    const repo = new MemoryRepo();
    await repo.create([tf("The aorta is an artery"), tf("The vena cava is a vein")]);
    sendIntent({ kind: "search", text: "aorta" });
    renderScreen(repo);
    await waitFor(() => expect(screen.queryByText("The vena cava is a vein")).toBeNull());
    expect((screen.getByLabelText("Search questions") as HTMLInputElement).value).toBe("aorta");
    cleanup();
    sendIntent({ kind: "import" });
    renderScreen(repo);
    expect(await screen.findByRole("tab", { name: "Paste JSON" })).toBeTruthy();
  });

  it("shows the empty state with Add and Import actions", async () => {
    renderScreen(new MemoryRepo());
    expect(await screen.findByText("Add your first questions")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Add question/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Import a file" })).toBeTruthy();
  });

  it("lists questions, searches, and shows a clear-filters state when nothing matches", async () => {
    const repo = new MemoryRepo();
    await repo.create([tf("The aorta is an artery"), tf("The vena cava is a vein")]);
    renderScreen(repo);
    expect(await screen.findByText("The aorta is an artery")).toBeTruthy();
    expect(screen.getByText("The vena cava is a vein")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search questions"), { target: { value: "aorta" } });
    await waitFor(() => expect(screen.queryByText("The vena cava is a vein")).toBeNull());
    expect(screen.getByText("The aorta is an artery")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search questions"), { target: { value: "xylophone" } });
    expect(await screen.findByText("No questions match")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]!);
    expect(await screen.findByText("The vena cava is a vein")).toBeTruthy();
  });

  it("archives selected questions and restores them from the Archive tab", async () => {
    const repo = new MemoryRepo();
    await repo.create([tf("Keep this question"), tf("Archive this question")]);
    renderScreen(repo);
    await screen.findByText("Archive this question");

    fireEvent.click(screen.getByLabelText(/Select: Archive this question/));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(screen.queryByText("Archive this question")).toBeNull());
    expect(screen.getByText("Keep this question")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Archive" }));
    fireEvent.click(await screen.findByLabelText(/Select: Archive this question/));
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(screen.queryByText("Archive this question")).toBeNull());

    fireEvent.click(screen.getByRole("tab", { name: "Questions" }));
    expect(await screen.findByText("Archive this question")).toBeTruthy();
  });

  it("requires typing DELETE before deleting forever", async () => {
    const repo = new MemoryRepo();
    const [madeId] = await repo.create([tf("Doomed question")]);
    await repo.bulk([madeId!], { kind: "archive" });
    renderScreen(repo);
    fireEvent.click(screen.getByRole("tab", { name: "Archive" }));
    fireEvent.click(await screen.findByLabelText(/Select: Doomed question/));
    fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
    const confirm = await screen.findByRole("button", { name: "Delete 1 question" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    expect(await screen.findByText("The archive is empty")).toBeTruthy();
  });

  it("opens the editor when a question is clicked", async () => {
    const repo = new MemoryRepo();
    await repo.create([tf("Open me")]);
    renderScreen(repo);
    fireEvent.click(await screen.findByText("Open me"));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
