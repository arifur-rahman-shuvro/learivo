import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../../../themes/ThemeProvider.tsx";
import { MemoryRepo } from "../data/memoryRepo.ts";
import { BankProvider } from "./bank.tsx";
import { ImportDialog } from "./ImportExportDialogs.tsx";
import { blankQuestion } from "../domain/model.ts";

const q = (stem: string, answer = true) => ({ type: "true_false", stem, answer });

function open(repo = new MemoryRepo()) {
  render(
    <ThemeProvider>
      <BankProvider repo={repo}>
        <ImportDialog onClose={() => undefined} />
      </BankProvider>
    </ThemeProvider>,
  );
  return repo;
}

const paste = (text: string) =>
  fireEvent.change(screen.getByLabelText("Paste the JSON here"), { target: { value: text } });
const check = () => fireEvent.click(screen.getByRole("button", { name: "Check questions" }));

afterEach(cleanup);

describe("Smart import", () => {
  it("opens on Paste JSON, and Check is disabled until something is pasted", () => {
    open();
    expect(screen.getByRole("tab", { name: "Paste JSON", selected: true })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Check questions" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    paste("[]");
    expect(
      (screen.getByRole("button", { name: "Check questions" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("pastes JSON from ChatGPT in a code block, shows a preview, imports and summarises", async () => {
    const repo = open();
    paste(
      `Here you go:\n\`\`\`json\n${JSON.stringify([q("First pasted"), q("Second pasted", false)])}\n\`\`\``,
    );
    check();
    expect(await screen.findByText(/Removed the code block markers/)).toBeTruthy();
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(within(preview).getByText("Preview (2 of 2)")).toBeTruthy();
    expect(within(preview).getByText("First pasted")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import 2 questions" }));
    expect(await screen.findByText("Imported 2 questions.")).toBeTruthy();
    expect((await repo.list({ ...(await import("../data/repo.ts")).DEFAULT_QUERY })).total).toBe(2);
  });

  it("shows a clear syntax error with the place and keeps the pasted text", async () => {
    open();
    const bad = '[\n {"type": "true_false",\n "stem": "x" "answer": true}\n]';
    paste(bad);
    check();
    expect(await screen.findByText(/not valid JSON/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit the pasted text" }));
    expect((screen.getByLabelText("Paste the JSON here") as HTMLTextAreaElement).value).toBe(bad);
  });

  it("separates valid, duplicate and invalid questions and lets the student skip duplicates", async () => {
    const repo = new MemoryRepo();
    await repo.create([
      { ...blankQuestion("true_false"), stem: "Already here", answer: { answer: true } },
    ]);
    open(repo);
    paste(
      JSON.stringify([
        q("Already here"), // duplicate of the bank
        q("Brand new"),
        q("Brand new"), // repeated in the paste
        { type: "sba", stem: "Missing options" }, // invalid
      ]),
    );
    check();
    await screen.findByText(/2 duplicates/);
    expect(screen.getByText(/1 already in your bank, 1 repeated in this import/)).toBeTruthy();
    expect(screen.getByText(/1 invalid question \(not imported\)/)).toBeTruthy();
    expect(screen.getByText(/Question 4:/)).toBeTruthy();
    // Skipping duplicates is the default: only "Brand new" once.
    fireEvent.click(screen.getByRole("button", { name: "Import 1 question" }));
    expect(await screen.findByText("Imported 1 question.")).toBeTruthy();
    expect(screen.getByText("duplicates skipped").previousSibling?.textContent).toBe("2");
    expect(screen.getByText("invalid skipped").previousSibling?.textContent).toBe("1");
  });

  it("can import duplicates anyway", async () => {
    const repo = new MemoryRepo();
    await repo.create([{ ...blankQuestion("true_false"), stem: "Same", answer: { answer: true } }]);
    open(repo);
    paste(JSON.stringify([q("Same")]));
    check();
    await screen.findByText(/1 duplicate/);
    expect(
      (screen.getByRole("button", { name: "Import 0 questions" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Import them anyway"));
    fireEvent.click(screen.getByRole("button", { name: "Import 1 question" }));
    expect(await screen.findByText("Imported 1 question.")).toBeTruthy();
  });

  it("still imports from an uploaded file", async () => {
    open();
    fireEvent.click(screen.getByRole("tab", { name: "Upload file" }));
    const file = new File([JSON.stringify({ questions: [q("From a file")] })], "qs.json", {
      type: "application/json",
    });
    fireEvent.change(screen.getByLabelText("Choose a file"), { target: { files: [file] } });
    expect(await screen.findByText("qs.json")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Import 1 question" }));
    expect(await screen.findByText("Imported 1 question.")).toBeTruthy();
  });

  it("rejects an unsupported file type", async () => {
    open();
    fireEvent.click(screen.getByRole("tab", { name: "Upload file" }));
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Choose a file"), { target: { files: [file] } });
    expect(await screen.findByText("Choose a .json or .csv file.")).toBeTruthy();
  });

  it("reports a failed import and explains that a retry makes no copies", async () => {
    const repo = new MemoryRepo();
    open(repo);
    paste(JSON.stringify([q("Will fail")]));
    check();
    await screen.findByText("Preview (1 of 1)");
    repo.create = async () => {
      throw new Error("Could not reach your question bank.");
    };
    fireEvent.click(screen.getByRole("button", { name: "Import 1 question" }));
    expect(await screen.findByText(/Import stopped\. Could not reach/)).toBeTruthy();
    expect(screen.getByText(/will not create copies/)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check again and retry" })).toBeTruthy(),
    );
  });
});
