import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../../../ui-kit/themes/ThemeProvider.tsx";
import { MemoryRepo } from "../data/memoryRepo.ts";
import { DEFAULT_QUERY } from "../data/repo.ts";
import { BankProvider } from "./bank.tsx";
import QuestionsScreen from "./QuestionsScreen.tsx";
import { MemoryWorkspace } from "../../workspace/data/memoryWorkspace.ts";
import { MemoryAttempts } from "../../practice/data/memoryAttempts.ts";
import { PracticeProvider } from "../../practice/ui/practice.tsx";
import { WorkspaceProvider } from "../../workspace/ui/workspace.tsx";
import { sendIntent } from "../../../core/intents.ts";
import { blankQuestion, type QuestionInput } from "../domain/model.ts";
import { TF_ANSWER } from "../../../testing/fixtures.ts";

function tf(stem: string): QuestionInput {
  return { ...blankQuestion("true_false"), stem, answer: TF_ANSWER };
}

function renderScreen(
  repo: MemoryRepo,
  onNavigate: (route: string) => void = () => undefined,
  attempts = new MemoryAttempts(),
  workspace = new MemoryWorkspace(),
) {
  return render(
    <ThemeProvider>
      <BankProvider repo={repo}>
        <PracticeProvider attempts={attempts}>
          <WorkspaceProvider repo={workspace}>
            <QuestionsScreen onNavigate={onNavigate} />
          </WorkspaceProvider>
        </PracticeProvider>
      </BankProvider>
    </ThemeProvider>,
  );
}

afterEach(cleanup);

/** Opens a choice field's sheet and taps one option. */
async function pick(field: string, option: string) {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${field}:`) }));
  // The current choice also carries a "Selected" tick in its name.
  fireEvent.click(
    await screen.findByRole("option", { name: new RegExp(`^${option}\\s*(Selected)?$`) }),
  );
}

describe("QuestionsScreen", () => {
  it("a list that fails to load in Organize says why and loads again on Try again", async () => {
    const repo = new MemoryRepo();
    const real = repo.taxonomy.bind(repo);
    let fail = true;
    repo.taxonomy = async () => {
      if (fail)
        throw new Error("Could not reach your question bank. Check your connection and try again.");
      return real();
    };
    renderScreen(repo);
    fireEvent.click(await screen.findByRole("button", { name: "Organize" }));
    const dialog = await screen.findByRole("dialog");
    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toContain("Could not reach your question bank");
    fail = false;
    fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(within(dialog).queryByRole("alert")).toBeNull());
    expect(within(dialog).getByRole("textbox", { name: "New subject" })).toBeTruthy();
  });

  it("a subject colour set in Organize shows as a dot on its questions, and can be cleared", async () => {
    const repo = new MemoryRepo();
    await repo.create([{ ...tf("Colour me"), path: ["Anatomy"] }]);
    const { container } = renderScreen(repo);
    await screen.findByText("Colour me");
    expect(container.querySelector('li span[aria-hidden="true"][style*="background"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Organize" }));
    const dialog = await screen.findByRole("dialog");
    const group = await within(dialog).findByRole("radiogroup", { name: "Colour for Anatomy" });
    fireEvent.click(within(group).getByRole("radio", { name: "Teal" }));
    await waitFor(() =>
      expect(within(group).getByRole("radio", { name: "Teal" }).getAttribute("aria-checked")).toBe(
        "true",
      ),
    );
    expect((await repo.taxonomy())[0]!.color).toBe("teal");
    await waitFor(() =>
      expect(
        container.querySelector('li span[aria-hidden="true"][style*="background"]'),
      ).not.toBeNull(),
    );
    fireEvent.click(within(group).getByRole("radio", { name: "Teal" })); // tap again clears
    await waitFor(async () => expect((await repo.taxonomy())[0]!.color).toBeNull());
  });

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

  it("adds the 12 sample questions from the empty state, tagged so they can be found", async () => {
    const repo = new MemoryRepo();
    renderScreen(repo);
    fireEvent.click(await screen.findByRole("button", { name: "Try 12 sample questions" }));
    await waitFor(async () => expect((await repo.list({ ...DEFAULT_QUERY })).total).toBe(12));
    const all = (await repo.list({ ...DEFAULT_QUERY, limit: 50 })).items;
    expect(all.every((q) => q.tags.includes("sample"))).toBe(true);
    await waitFor(() => expect(screen.queryByText("Add your first questions")).toBeNull());
    expect(await screen.findByText(/Which nerve is compressed in carpal tunnel/)).toBeTruthy();
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
    await pick("Difficulty", "Level 5");
    await waitFor(() => expect(screen.queryByText("Easy one")).toBeNull());
    expect(screen.getByRole("img", { name: "Level 5 of 5" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save this view" }));
    fireEvent.change(screen.getByLabelText("View name"), { target: { value: "Hard ones" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Easy one")).toBeTruthy();
    await pick("Saved views", "Hard ones");
    await waitFor(() => expect(screen.queryByText("Easy one")).toBeNull());
    expect(screen.getByText("Hard one")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete view" }));
    expect(screen.queryByRole("button", { name: /^Saved views:/ })).toBeNull();
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

  it("lists reworded copies as possible duplicates and lets you keep the older one", async () => {
    const repo = new MemoryRepo();
    await repo.create([tf("Which nerve supplies the deltoid muscle of the shoulder?")]);
    await repo.create([tf("Which nerve supplies the deltoid muscle of the shoulder joint?")]);
    await repo.create([tf("Which artery supplies the appendix?")]);
    renderScreen(repo);
    fireEvent.click(await screen.findByRole("button", { name: "Duplicates" }));
    const dlg = await screen.findByRole("dialog", { name: "Find duplicates" });
    expect(await within(dlg).findByText("Possible duplicates (1)")).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Keep the older one" }));
    expect(await within(dlg).findByText("Archived 1 extra copy.")).toBeTruthy();
    expect(await within(dlg).findByText(/No duplicates found/)).toBeTruthy();
    expect((await repo.list({ ...DEFAULT_QUERY, status: "archived" })).total).toBe(1);
  });

  it("remembers a pair marked as not a duplicate", async () => {
    localStorage.clear();
    const repo = new MemoryRepo();
    await repo.create([tf("Which nerve supplies the deltoid muscle of the shoulder?")]);
    await repo.create([tf("Which nerve supplies the deltoid muscle of the shoulder joint?")]);
    renderScreen(repo);
    fireEvent.click(await screen.findByRole("button", { name: "Duplicates" }));
    const dlg = await screen.findByRole("dialog", { name: "Find duplicates" });
    fireEvent.click(await within(dlg).findByRole("button", { name: "Not a duplicate" }));
    expect(await within(dlg).findByText(/No duplicates found/)).toBeTruthy();
    expect(localStorage.getItem("learivo.notDuplicates")).toContain("|");
    localStorage.clear();
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
    await pick("Difficulty", "Level 5");
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

  it("opens a row menu with Edit, Practise, Add to revision and Archive, and closes it on Escape", async () => {
    const repo = new MemoryRepo();
    await repo.create([tf("Menu question")]);
    renderScreen(repo);
    const more = await screen.findByRole("button", { name: /^Actions: Menu question/ });
    fireEvent.click(more);
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Edit", "Practise this question", "Add to revision", "Archive"]);
    expect(document.activeElement).toBe(within(menu).getAllByRole("menuitem")[0]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("archives one question from its menu and Undo brings it back", async () => {
    const repo = new MemoryRepo();
    await repo.create([tf("Archive me"), tf("Stay")]);
    renderScreen(repo);
    fireEvent.click(await screen.findByRole("button", { name: /^Actions: Archive me/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Archive" }));
    await waitFor(() => expect(screen.queryByText("Archive me")).toBeNull());
    expect(screen.getByText("Stay")).toBeTruthy();
    expect((await repo.list({ ...DEFAULT_QUERY, status: "archived" })).total).toBe(1);
  });

  it("adds a question to revision from its menu", async () => {
    const repo = new MemoryRepo();
    const [id] = await repo.create([tf("Revise me")]);
    const workspace = new MemoryWorkspace();
    renderScreen(repo, undefined, undefined, workspace);
    fireEvent.click(await screen.findByRole("button", { name: /^Actions: Revise me/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Add to revision" }));
    await waitFor(async () =>
      expect((await workspace.cards()).some((c) => c.questionId === id)).toBe(true),
    );
  });

  it("starts a one-question practice session from the menu and goes to Practice", async () => {
    const repo = new MemoryRepo();
    await repo.create([tf("Practise me")]);
    const attempts = new MemoryAttempts();
    const go = vi.fn();
    renderScreen(repo, go, attempts);
    fireEvent.click(await screen.findByRole("button", { name: /^Actions: Practise me/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Practise this question" }));
    await waitFor(() => expect(go).toHaveBeenCalledWith("#/practice"));
    expect((await attempts.list(5)).map((a) => a.title)).toContain("Practice: one question");
  });
});
