import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../ui-kit/themes/ThemeProvider.tsx";
import AppShell from "./AppShell.tsx";
import { AuthProvider } from "../auth/AuthProvider.tsx";
import { fakeAuth } from "../core/testing/fakeAuth.ts";
import { MemoryRepo } from "../modules/question-bank/data/memoryRepo.ts";
import { MemoryAttempts } from "../modules/practice/data/memoryAttempts.ts";
import { MemoryWorkspace } from "../modules/workspace/data/memoryWorkspace.ts";
import { MemoryProfile } from "../modules/profile/data/memoryProfile.ts";
import { ALL_FEATURES } from "./features.ts";

function shell() {
  render(
    <ThemeProvider>
      <AuthProvider client={fakeAuth({ id: "u1", email: "sara@example.test" })}>
        <AppShell
          makeRepo={() => new MemoryRepo()}
          makeAttempts={() => new MemoryAttempts()}
          makeWorkspace={() => new MemoryWorkspace()}
          makeProfile={() => new MemoryProfile()}
        />
      </AuthProvider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

const openAll = async () => {
  window.location.hash = "#/home";
  fireEvent.click(await screen.findByRole("button", { name: "All features" }));
  return screen.findByRole("dialog", { name: "All features" });
};

describe("All features", () => {
  it("lists every feature with a title and a description, grouped", async () => {
    shell();
    const dlg = await openAll();
    expect(within(dlg).getAllByRole("region")).toHaveLength(5);
    for (const f of ALL_FEATURES) {
      expect(within(dlg).getByRole("button", { name: new RegExp(f.title) })).toBeTruthy();
    }
  });

  it("filters by what the student types", async () => {
    shell();
    const dlg = await openAll();
    fireEvent.change(within(dlg).getByLabelText("Find a feature"), { target: { value: "flash" } });
    expect(within(dlg).getAllByRole("button", { name: /Flashcards/ })).toHaveLength(1);
    expect(within(dlg).queryByRole("button", { name: /Insights/ })).toBeNull();
    fireEvent.change(within(dlg).getByLabelText("Find a feature"), { target: { value: "zzzz" } });
    expect(within(dlg).getByText("No feature matches that.")).toBeTruthy();
  });

  it("opens the right screen and tab", async () => {
    shell();
    const dlg = await openAll();
    fireEvent.click(within(dlg).getByRole("button", { name: /Mistake notebook/ }));
    expect(window.location.hash).toBe("#/review");
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Mistakes/ }).getAttribute("aria-selected")).toBe(
        "true",
      ),
    );
  });

  it("opens the prompt maker inside Questions", async () => {
    shell();
    const dlg = await openAll();
    fireEvent.click(within(dlg).getByRole("button", { name: /Make an AI prompt/ }));
    expect(window.location.hash).toBe("#/questions");
    const imp = await screen.findByRole("dialog", { name: "Import questions" });
    expect(
      within(imp).getByRole("tab", { name: "Make a prompt" }).getAttribute("aria-selected"),
    ).toBe("true");
  });
});

describe("User guide", () => {
  it("opens from the account menu and ticks steps from the student's own data", async () => {
    const repo = new MemoryRepo();
    const ws = new MemoryWorkspace();
    await ws.setExamTarget({ title: "Final", date: "2027-03-01" });
    render(
      <ThemeProvider>
        <AuthProvider client={fakeAuth({ id: "u1", email: "sara@example.test" })}>
          <AppShell
            makeRepo={() => repo}
            makeAttempts={() => new MemoryAttempts()}
            makeWorkspace={() => ws}
            makeProfile={() => new MemoryProfile()}
          />
        </AuthProvider>
      </ThemeProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "User guide" }));
    const dlg = await screen.findByRole("dialog", { name: "User guide" });
    const steps = within(
      await within(dlg).findByRole("region", { name: "First steps" }),
    ).getAllByRole("listitem");
    expect(steps).toHaveLength(6);
    await waitFor(() => expect(within(dlg).getByText(/1 of 6 done/)).toBeTruthy());
    expect(within(steps[5]!).getByText("(done)")).toBeTruthy();
    expect(within(steps[0]!).queryByText("(done)")).toBeNull();
    expect(within(dlg).getByText("How marks are worked out")).toBeTruthy();
  });

  it("a step takes the student to the right place", async () => {
    shell();
    window.location.hash = "#/home";
    fireEvent.click(await screen.findByRole("button", { name: "User guide" }));
    const dlg = await screen.findByRole("dialog", { name: "User guide" });
    fireEvent.click(within(dlg).getByRole("button", { name: "Add questions" }));
    expect(window.location.hash).toBe("#/questions");
    expect(await screen.findByRole("dialog", { name: "Add questions" })).toBeTruthy();
  });
});
