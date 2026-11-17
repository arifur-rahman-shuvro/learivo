import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRepo } from "../modules/question-bank/data/memoryRepo.ts";
import { BankProvider } from "../modules/question-bank/ui/bank.tsx";
import { MemoryWorkspace } from "../modules/workspace/data/memoryWorkspace.ts";
import { MemoryAttempts } from "../modules/practice/data/memoryAttempts.ts";
import { PracticeProvider } from "../modules/practice/ui/practice.tsx";
import { WorkspaceProvider } from "../modules/workspace/ui/workspace.tsx";
import { blankQuestion } from "../modules/question-bank/domain/model.ts";
import BackupDialog from "./BackupDialog.tsx";
import { closeBackup, openBackup } from "./backupStore.ts";

function setup(bank = new MemoryRepo(), ws = new MemoryWorkspace()) {
  render(
    <BankProvider repo={bank}>
      <WorkspaceProvider repo={ws}>
        <PracticeProvider attempts={new MemoryAttempts()}>
          <BackupDialog />
        </PracticeProvider>
      </WorkspaceProvider>
    </BankProvider>,
  );
  act(() => openBackup());
  return { bank, ws };
}

afterEach(cleanup);

describe("BackupDialog", () => {
  it("rejects a file that is not a backup", async () => {
    setup();
    const file = new File(["hello"], "x.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Choose backup file"), { target: { files: [file] } });
    expect((await screen.findByRole("alert")).textContent).toContain("not a Learivo backup");
    act(() => closeBackup());
  });

  it("previews then restores a backup", async () => {
    const src = new MemoryRepo();
    await src.create([
      {
        ...blankQuestion("sba"),
        stem: "Restore me?",
        answer: {
          options: [
            { text: "A", correct: true },
            { text: "B", correct: false },
          ],
        },
      },
    ]);
    const { buildBackup } = await import("./backupData.ts");
    const json = JSON.stringify(await buildBackup(src, new MemoryWorkspace()));
    const { bank } = setup();
    fireEvent.change(screen.getByLabelText("Choose backup file"), {
      target: { files: [new File([json], "b.json", { type: "application/json" })] },
    });
    await screen.findByText("1 new question");
    fireEvent.click(screen.getByRole("button", { name: "Restore now" }));
    await screen.findByText("Restore finished.");
    await waitFor(async () => expect(await bank.exportAll()).toHaveLength(1));
    act(() => closeBackup());
  });
});
