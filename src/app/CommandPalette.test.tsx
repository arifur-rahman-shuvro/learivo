import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineProvider } from "../offline/OfflineProvider.tsx";
import { MemoryRepo } from "../modules/question-bank/data/memoryRepo.ts";
import { blankQuestion } from "../modules/question-bank/domain/model.ts";
import { MemoryAttempts } from "../modules/practice/data/memoryAttempts.ts";
import CommandPalette from "./CommandPalette.tsx";
import { useIntent, type Intent } from "./intents.ts";

function Probe({ onIntent }: { onIntent: (i: Intent) => void }) {
  useIntent(onIntent);
  return null;
}

async function setup() {
  const bank = new MemoryRepo();
  await bank.create([
    { ...blankQuestion("true_false"), stem: "Heart pumps blood", answer: { answer: true } },
    { ...blankQuestion("true_false"), stem: "Femur is a bone", answer: { answer: true } },
  ]);
  const onNavigate = vi.fn();
  const onIntent = vi.fn();
  render(
    <OfflineProvider
      userId="u1"
      injected={{ bank, attempts: new MemoryAttempts() }}
      live={() => ({ bank, attempts: new MemoryAttempts() })}
    >
      <Probe onIntent={onIntent} />
      <CommandPalette onNavigate={onNavigate} />
    </OfflineProvider>,
  );
  fireEvent.keyDown(document, { key: "k", ctrlKey: true });
  const box = await screen.findByRole("combobox");
  return { box, onNavigate, onIntent };
}

afterEach(cleanup);

describe("CommandPalette", () => {
  it("opens with Ctrl+K, lists screens and actions, and closes with Escape", async () => {
    await setup();
    expect(screen.getByRole("option", { name: "Practice" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Add question" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
  });

  it("goes to a screen with the keyboard", async () => {
    const { box, onNavigate } = await setup();
    fireEvent.change(box, { target: { value: "insights" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith("#/insights");
  });

  it("finds a command by a related word and asks the Questions screen to open the form", async () => {
    const { box, onNavigate, onIntent } = await setup();
    fireEvent.change(box, { target: { value: "new" } });
    fireEvent.click(screen.getByRole("option", { name: "Add question" }));
    expect(onNavigate).toHaveBeenCalledWith("#/questions");
    expect(onIntent).toHaveBeenCalledWith({ kind: "add" });
  });

  it("searches questions and opens the list with that search", async () => {
    const { box, onNavigate, onIntent } = await setup();
    fireEvent.change(box, { target: { value: "heart" } });
    const hit = await screen.findByRole("option", { name: /Heart pumps blood/ });
    expect(screen.queryByRole("option", { name: /Femur/ })).toBeNull();
    fireEvent.click(hit);
    expect(onNavigate).toHaveBeenCalledWith("#/questions");
    expect(onIntent).toHaveBeenCalledWith({ kind: "search", text: "Heart pumps blood" });
  });

  it("says when nothing matches", async () => {
    const { box } = await setup();
    fireEvent.change(box, { target: { value: "zzzz" } });
    expect(screen.queryByRole("option", { name: "Practice" })).toBeNull();
  });
});
