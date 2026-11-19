import { afterEach, describe, expect, it, vi } from "vitest";
import { reloadAi, removeKey, saveAi } from "../../ai/keys.ts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../../../ui-kit/themes/ThemeProvider.tsx";
import { MemoryRepo } from "../data/memoryRepo.ts";
import { BankProvider } from "./bank.tsx";
import { ImportDialog } from "./ImportExportDialogs.tsx";
import { blankQuestion } from "../domain/model.ts";
import { TF_ANSWER } from "../../../testing/fixtures.ts";

const q = (stem: string) => ({
  type: "true_false",
  stem,
  options: ["a", "b", "c", "d", "e"].map((text, i) => ({ text, correct: i === 0 })),
});

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

  it("pastes JSON from AI in a code block, shows a preview, imports and summarises", async () => {
    const repo = open();
    paste(
      `Here you go:\n\`\`\`json\n${JSON.stringify([q("First pasted"), q("Second pasted")])}\n\`\`\``,
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
      { ...blankQuestion("true_false"), stem: "Already here", answer: TF_ANSWER },
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
    await repo.create([{ ...blankQuestion("true_false"), stem: "Same", answer: TF_ANSWER }]);
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

  it("can replace the questions already in the bank instead of adding copies", async () => {
    const repo = new MemoryRepo();
    await repo.create([{ ...blankQuestion("true_false"), stem: "Same", answer: TF_ANSWER }]);
    open(repo);
    paste(JSON.stringify([{ ...q("Same"), explanation: "Updated explanation" }, q("Brand new")]));
    check();
    await screen.findByText(/1 duplicate/);
    fireEvent.click(screen.getByLabelText("Replace the ones already in my bank"));
    fireEvent.click(screen.getByRole("button", { name: "Import 2 questions" }));
    expect(await screen.findByText("Imported 2 questions.")).toBeTruthy();
    expect(screen.getByText("replaced").previousSibling?.textContent).toBe("1");
    const all = await repo.list({ ...(await import("../data/repo.ts")).DEFAULT_QUERY });
    expect(all.total).toBe(2);
    expect(all.items.find((x) => x.stem === "Same")!.explanation).toBe("Updated explanation");
  });

  describe("prompt maker and fixes", () => {
    const copied: string[] = [];
    const clip = () => {
      copied.length = 0;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: (t: string) => (copied.push(t), Promise.resolve()) },
      });
    };

    it("builds a prompt from the form and copies it", async () => {
      clip();
      open();
      fireEvent.click(screen.getByRole("tab", { name: "Make a prompt" }));
      fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Anatomy" } });
      fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "Heart" } });
      fireEvent.change(screen.getByLabelText("Exam year"), { target: { value: "2024" } });
      const box = screen.getByRole("region", { name: "Your prompt" });
      expect(box.textContent).toContain('"subject": "Anatomy"');
      expect(box.textContent).toContain("Anatomy > Heart");
      fireEvent.click(screen.getByLabelText(/Copy existing questions/));
      expect(box.textContent).toContain("Do not write new questions");
      fireEvent.click(screen.getByRole("button", { name: "Copy prompt" }));
      expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
      expect(copied[0]).toContain('"exam_year": "2024"');
    });

    it("generates questions with the connected AI and shows them for review", async () => {
      localStorage.clear();
      saveAi("openai", "sk-test", "");
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                choices: [{ message: { content: JSON.stringify([q("Written by AI")]) } }],
              }),
            ),
          ),
        ),
      );
      open();
      fireEvent.click(screen.getByRole("tab", { name: "Generate with AI" }));
      fireEvent.click(screen.getByRole("button", { name: "Generate questions" }));
      await screen.findByRole("region", { name: "Preview" });
      expect(screen.getByText(/Written by AI/)).toBeTruthy();
      vi.unstubAllGlobals();
      removeKey("openai");
    });

    it("runs the whole AI flow: connect, write in two batches, flag a reworded copy, import the rest", async () => {
      localStorage.clear();
      saveAi("openai", "sk-test", "");
      const repo = new MemoryRepo();
      await repo.create([
        {
          ...blankQuestion("true_false"),
          stem: "Which nerve supplies the deltoid muscle?",
          answer: TF_ANSWER,
        },
      ]);
      const fresh = (n: number) => q(`Fresh question number ${n} about the brachial plexus`);
      let call = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(() => {
          call += 1;
          const items =
            call === 1
              ? Array.from({ length: 25 }, (_, i) => fresh(i))
              : [
                  q("Which nerve supplies the deltoid muscle"),
                  fresh(100),
                  fresh(101),
                  fresh(102),
                  fresh(103),
                ];
          return Promise.resolve(
            new Response(
              JSON.stringify({ choices: [{ message: { content: JSON.stringify(items) } }] }),
            ),
          );
        }),
      );
      open(repo);
      fireEvent.click(screen.getByRole("tab", { name: "Generate with AI" }));
      fireEvent.change(screen.getByLabelText("How many questions"), { target: { value: "30" } });
      fireEvent.click(screen.getByRole("button", { name: /Generate questions/ }));
      await screen.findByRole("region", { name: "Preview" }, { timeout: 4000 });
      expect(call).toBe(2);
      expect(screen.getByText("look similar")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /^Import 29 questions/ }));
      await screen.findByText("Imported 29 questions.");
      const total = (await repo.list({ ...(await import("../data/repo.ts")).DEFAULT_QUERY })).total;
      expect(total).toBe(30);
      vi.unstubAllGlobals();
      removeKey("openai");
    });

    it("offers to connect an AI when none is connected", () => {
      localStorage.clear();
      reloadAi();
      open();
      fireEvent.click(screen.getByRole("tab", { name: "Generate with AI" }));
      expect(screen.getByRole("button", { name: "Connect an AI" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Generate questions" })).toBeNull();
    });

    it("adds details to every question that lacks them and keeps the ones it has", async () => {
      const repo = open();
      paste(JSON.stringify([q("No subject"), { ...q("Has subject"), subject: "Physiology" }]));
      check();
      await screen.findByRole("region", { name: "Preview" });
      fireEvent.click(screen.getByText(/Add to every question/));
      fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Anatomy" } });
      fireEvent.change(screen.getByLabelText("Tags (comma separated)"), {
        target: { value: "imported" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Import 2 questions" }));
      await screen.findByText("Imported 2 questions.");
      const items = (await repo.list({ ...(await import("../data/repo.ts")).DEFAULT_QUERY })).items;
      const by = Object.fromEntries(items.map((x) => [x.stem, x]));
      expect(by["No subject"]?.path).toEqual(["Anatomy"]);
      expect(by["Has subject"]?.path).toEqual(["Physiology"]);
      expect(by["Has subject"]?.tags).toContain("imported");
    });

    it("copies a fix request listing the invalid questions", async () => {
      clip();
      open();
      paste(JSON.stringify([q("Good"), { type: "sba", stem: "Bad one", options: [] }]));
      check();
      fireEvent.click(await screen.findByRole("button", { name: /Copy a fix request/ }));
      expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
      expect(copied[0]).toContain("Question 2");
      expect(copied[0]).toContain("Fix only these questions");
    });
  });
});
