import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../../../themes/ThemeProvider.tsx";
import { MemoryRepo } from "../data/memoryRepo.ts";
import { DEFAULT_QUERY } from "../data/repo.ts";
import { BankProvider } from "./bank.tsx";
import QuestionsScreen from "./QuestionsScreen.tsx";
import { MemoryWorkspace } from "../../workspace/data/memoryWorkspace.ts";
import { WorkspaceProvider } from "../../workspace/ui/workspace.tsx";
import { sendIntent } from "../../../app/intents.ts";
import { blankQuestion, type QuestionInput } from "../domain/model.ts";
import { TF_ANSWER } from "../../../test/fixtures.ts";

function tf(stem: string): QuestionInput {
  return { ...blankQuestion("true_false"), stem, answer: TF_ANSWER };
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

describe("Add questions hub", () => {
  it("offers every way in and opens the matching screen", async () => {
    const repo = new MemoryRepo();
    renderScreen(repo);
    fireEvent.click(await screen.findByRole("button", { name: "Add questions" }));
    const hub = await screen.findByRole("dialog", { name: "Add questions" });
    for (const name of [
      "Write one question",
      "Generate with AI",
      "Make a prompt for AI",
      "Paste what AI gave you",
      "Upload a file",
      "Add a subject or topic first",
    ]) {
      expect(within(hub).getByRole("button", { name: new RegExp(name) })).toBeTruthy();
    }
    fireEvent.click(within(hub).getByRole("button", { name: /Make a prompt for AI/ }));
    const imp = await screen.findByRole("dialog", { name: "Import questions" });
    expect(
      within(imp).getByRole("tab", { name: "Make a prompt" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(within(imp).getByRole("region", { name: "Your prompt" })).toBeTruthy();
    expect(within(imp).queryByRole("region", { name: "Generate with AI" })).toBeNull();
  });

  it("opens the Generate with AI tab from the hub, without the copy-prompt box", async () => {
    renderScreen(new MemoryRepo());
    fireEvent.click(await screen.findByRole("button", { name: "Add questions" }));
    const hub = await screen.findByRole("dialog", { name: "Add questions" });
    fireEvent.click(within(hub).getByRole("button", { name: /Generate with AI/ }));
    const imp = await screen.findByRole("dialog", { name: "Import questions" });
    expect(
      within(imp).getByRole("tab", { name: "Generate with AI" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(within(imp).getByRole("region", { name: "Generate with AI" })).toBeTruthy();
    expect(within(imp).queryByRole("region", { name: "Your prompt" })).toBeNull();
  });

  it("opens the subject organizer from the hub", async () => {
    renderScreen(new MemoryRepo());
    fireEvent.click(await screen.findByRole("button", { name: "Add questions" }));
    fireEvent.click(await screen.findByRole("button", { name: /Add a subject or topic first/ }));
    const dlg = await screen.findByRole("dialog", { name: "Organize your bank" });
    expect(within(dlg).getByLabelText("New subject")).toBeTruthy();
  });

  it("saves a filter as a named view and brings it back", async () => {
    localStorage.clear();
    const repo = new MemoryRepo();
    await repo.create([
      { ...tf("Easy one"), difficulty: 1 },
      { ...tf("Hard one"), difficulty: 5 },
    ]);
    renderScreen(repo);
    fireEvent.change(await screen.findByLabelText("Filter by difficulty"), {
      target: { value: "5" },
    });
    await waitFor(() => expect(screen.queryByText("Easy one")).toBeNull());
    expect(screen.getByRole("img", { name: "Level 5 of 5" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save this view" }));
    fireEvent.change(screen.getByLabelText("View name"), { target: { value: "Hard ones" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Easy one")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Saved views"), { target: { value: "Hard ones" } });
    await waitFor(() => expect(screen.queryByText("Easy one")).toBeNull());
    expect(screen.getByText("Hard one")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete view" }));
    expect(screen.queryByLabelText("Saved views")).toBeNull();
    localStorage.clear();
  });

  it("finds a question saved twice and archives the extra copy", async () => {
    const repo = new MemoryRepo();
    await repo.create([tf("Same question"), tf("Other question")]);
    await repo.create([tf("Same  question ")]);
    renderScreen(repo);
    fireEvent.click(await screen.findByRole("button", { name: "Duplicates" }));
    const dlg = await screen.findByRole("dialog", { name: "Find duplicates" });
    expect(await within(dlg).findByText("1 extra copy")).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Archive all 1 extra copy" }));
    expect(await within(dlg).findByText("Archived 1 extra copy.")).toBeTruthy();
    expect(await within(dlg).findByText(/No duplicates found/)).toBeTruthy();
    const archived = await repo.list({ ...DEFAULT_QUERY, status: "archived" });
    expect(archived.total).toBe(1);
  });

  it("shows active filters as chips you can remove, and a Filters button for phones", async () => {
    const repo = new MemoryRepo();
    await repo.create([
      { ...tf("Easy one"), difficulty: 1 },
      { ...tf("Hard one"), difficulty: 5 },
    ]);
    renderScreen(repo);
    const toggle = await screen.findByRole("button", { name: "Filters" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByLabelText("Filter by difficulty"), { target: { value: "5" } });
    await waitFor(() => expect(screen.queryByText("Easy one")).toBeNull());
    expect(screen.getByRole("button", { name: "Filters (1)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Difficulty 5" }));
    expect(await screen.findByText("Easy one")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
  });

  it("loads the next page when the end of the list scrolls into view", async () => {
    const repo = new MemoryRepo();
    await repo.create(Array.from({ length: 60 }, (_, i) => tf(`Question number ${i}`)));
    let fire: (() => void) | null = null;
    class FakeObserver {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        fire = () => cb([{ isIntersecting: true }]);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    try {
      renderScreen(repo);
      await screen.findByText("Show more (10 left)", { exact: false });
      fire!();
      await waitFor(() => expect(screen.queryByText(/Show more/)).toBeNull());
      expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(60);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
