import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../themes/ThemeProvider.tsx";
import { OfflineProvider } from "../offline/OfflineProvider.tsx";
import { MemoryRepo } from "../modules/question-bank/data/memoryRepo.ts";
import { MemoryAttempts } from "../modules/practice/data/memoryAttempts.ts";
import type { ClearScope, DataCounts, DataRepo } from "../modules/data/data/repo.ts";
import DataDialog from "./DataDialog.tsx";

const COUNTS: DataCounts = {
  questions: 120,
  sessions: 8,
  exams: 2,
  cards: 5,
  bookmarks: 3,
  notes: 1,
};

function setup(data: Partial<DataRepo> = {}) {
  const calls: ClearScope[] = [];
  const repo: DataRepo = {
    counts: async () => COUNTS,
    clear: async (scope, onProgress) => {
      calls.push(scope);
      onProgress?.("Sessions");
    },
    ...data,
  };
  const onClose = vi.fn();
  const onCleared = vi.fn();
  const bank = new MemoryRepo();
  const attempts = new MemoryAttempts();
  render(
    <ThemeProvider>
      <OfflineProvider userId="u1" live={() => ({ bank, attempts, data: repo })}>
        <DataDialog open onClose={onClose} onCleared={onCleared} />
      </OfflineProvider>
    </ThemeProvider>,
  );
  return { calls, onClose, onCleared };
}

afterEach(cleanup);

describe("DataDialog", () => {
  it("shows what is stored before anything is deleted", async () => {
    setup();
    expect(await screen.findByText(/8 sessions with their answers/)).toBeTruthy();
    expect(
      screen.getByText(/120 questions, with 3 bookmarks, 1 note and 5 revision cards/),
    ).toBeTruthy();
    expect(screen.getByText(/2 saved exams/)).toBeTruthy();
  });

  it("will not delete until DELETE is typed, then clears and reports done", async () => {
    const { calls, onCleared } = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Clear history…" }));
    const confirm = screen.getByRole("button", { name: "Clear history" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "delete" },
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(confirm);
    expect(await screen.findByText(/Done\. Clear practice history finished\./)).toBeTruthy();
    expect(calls).toEqual(["practice"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it("goes back without deleting", async () => {
    const { calls } = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Delete everything…" }));
    expect(screen.getByText(/permanently deletes all questions, sessions, exams/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Delete questions…" })).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("shows a problem and lets the student try again", async () => {
    let fail = true;
    const { calls } = setup({
      clear: async (scope) => {
        if (fail)
          throw new Error("Could not reach your account. Check your connection and try again.");
        calls.push(scope);
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Delete questions…" }));
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete questions" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not reach/);
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Delete questions" }));
    await waitFor(() => expect(calls).toEqual(["questions"]));
  });
});
