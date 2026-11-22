import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRepo } from "../../modules/question-bank/data/memoryRepo.ts";
import { BankProvider } from "../../modules/question-bank/ui/bank.tsx";
import { MemoryWorkspace } from "../../modules/workspace/data/memoryWorkspace.ts";
import { MemoryAttempts } from "../../modules/practice/data/memoryAttempts.ts";
import { PracticeProvider } from "../../modules/practice/ui/practice.tsx";
import { WorkspaceProvider } from "../../modules/workspace/ui/workspace.tsx";
import { closeBackup, openBackup } from "../../core/dialogs/backup.ts";

const saved = vi.hoisted(() => vi.fn());
vi.mock("../../core/saveFile.ts", () => ({ saveTextFile: saved }));
vi.mock("../../platform/offline/OfflineProvider.tsx", () => ({
  useOfflineControls: () => ({
    pack: {
      flushEdits: async () => undefined,
      pendingSummaries: async () => ["Edit: Heart question"],
    },
    ws: null,
  }),
}));

import BackupDialog from "./BackupDialog.tsx";

afterEach(() => {
  act(() => closeBackup());
  cleanup();
  saved.mockClear();
});

describe("Backup with changes waiting on the device", () => {
  it("says what is missing, and saves only when the student chooses to", async () => {
    render(
      <BankProvider repo={new MemoryRepo()}>
        <WorkspaceProvider repo={new MemoryWorkspace()}>
          <PracticeProvider attempts={new MemoryAttempts()}>
            <BackupDialog />
          </PracticeProvider>
        </WorkspaceProvider>
      </BankProvider>,
    );
    act(() => openBackup());
    fireEvent.click(screen.getByRole("button", { name: "Download backup" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("1 change on this device could not be sent");
    expect(alert.textContent).toContain("Edit: Heart question");
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save without them" }));
    await screen.findByText(/Saved 0 questions/);
    expect(saved).toHaveBeenCalledTimes(1);
  });
});
