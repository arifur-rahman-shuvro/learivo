import { Profiler } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OfflineProvider, useServices } from "../../platform/offline/OfflineProvider.tsx";
import { MemoryRepo } from "../../modules/question-bank/data/memoryRepo.ts";
import { blankQuestion } from "../../modules/question-bank/domain/model.ts";
import { MemoryAttempts } from "../../modules/practice/data/memoryAttempts.ts";
import SyncIndicator from "./SyncIndicator.tsx";
import { TF_ANSWER } from "../../testing/fixtures.ts";

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
};

async function renderIndicator() {
  const bank = new MemoryRepo();
  await bank.create([
    { ...blankQuestion("true_false"), stem: "Heart pumps blood", answer: TF_ANSWER },
  ]);
  render(
    <OfflineProvider userId="u1" live={() => ({ bank, attempts: new MemoryAttempts() })}>
      <SyncIndicator />
    </OfflineProvider>,
  );
}

afterEach(() => {
  cleanup();
  setOnline(true);
});

describe("SyncIndicator", () => {
  it("says everything is saved, then offline when the connection drops", async () => {
    await renderIndicator();
    expect(await screen.findByRole("button", { name: /Saved/ })).toBeTruthy();
    act(() => setOnline(false));
    expect(await screen.findByRole("button", { name: /Offline/ })).toBeTruthy();
  });

  it("keeps a copy of the questions on the device and can remove it", async () => {
    await renderIndicator();
    fireEvent.click(await screen.findByRole("button", { name: /Saved/ }));
    // The copy is downloaded automatically on the first visit.
    expect(await screen.findByText(/1 question, updated/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove copy" }));
    expect(await screen.findByText("No copy is kept on this device.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download copy" }));
    await waitFor(() => expect(screen.getByText(/1 question, updated/)).toBeTruthy());
  });

  it("lists each change made offline, and clears the list once it is sent", async () => {
    let tag: (name: string) => Promise<unknown> = async () => undefined;
    function Probe() {
      const { bank } = useServices();
      tag = (n) => bank.addTag(n);
      return null;
    }
    const bank = new MemoryRepo();
    render(
      <OfflineProvider userId="u1" live={() => ({ bank, attempts: new MemoryAttempts() })}>
        <Probe />
        <SyncIndicator />
      </OfflineProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Saved/ }));
    await screen.findByText(/0 questions, updated/);
    act(() => setOnline(false));
    await act(async () => {
      await tag("later");
    });
    const list = await screen.findByRole("list", { name: "Waiting changes" });
    expect(list.textContent).toBe("Add tag: later");
    act(() => setOnline(true));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Waiting changes" })).toBeNull());
    expect((await bank.tags()).map((t) => t.name)).toEqual(["later"]);
  });

  it("disables downloading while offline", async () => {
    await renderIndicator();
    act(() => setOnline(false));
    fireEvent.click(await screen.findByRole("button", { name: /Offline/ }));
    expect(screen.getByText(/You are offline/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sync now" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("settles: it does not keep redrawing while idle (regression: the app froze)", async () => {
    const bank = new MemoryRepo();
    let draws = 0;
    render(
      <OfflineProvider userId="u1" live={() => ({ bank, attempts: new MemoryAttempts() })}>
        <Profiler id="indicator" onRender={() => (draws += 1)}>
          <SyncIndicator />
        </Profiler>
      </OfflineProvider>,
    );
    await screen.findByRole("button", { name: /Saved/ });
    await new Promise((r) => setTimeout(r, 500));
    const settled = draws;
    await new Promise((r) => setTimeout(r, 500));
    expect(draws).toBe(settled);
    expect(settled).toBeLessThan(10);
  });
});
