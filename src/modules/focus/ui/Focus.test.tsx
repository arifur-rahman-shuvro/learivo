import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../../ui-kit/themes/ThemeProvider.tsx";
import { MemoryFocus } from "../data/memoryFocus.ts";
import { FocusProvider } from "./FocusProvider.tsx";
import { FocusPill } from "./FocusPill.tsx";
import { digitGroups } from "./FlipClock.tsx";
import StudyScreen from "./StudyScreen.tsx";
import type { FocusRecord } from "../domain/engine.ts";

const START = new Date(2026, 10, 26, 9, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"],
  });
  vi.setSystemTime(START);
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
});

function ui(repo = new MemoryFocus(), user = "u1", pill = false) {
  return (
    <ThemeProvider>
      <FocusProvider userId={user} repo={repo}>
        <StudyScreen />
        {pill && <FocusPill onOpen={() => undefined} />}
      </FocusProvider>
    </ThemeProvider>
  );
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("Study screen", () => {
  it("starts a Pomodoro, counts down from timestamps, pauses and resumes", async () => {
    render(ui());
    await flush();
    expect(screen.getByText("25:00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await advance(61_000);
    expect(screen.getByRole("timer").textContent).toBe("23:59");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await advance(10 * 60_000); // ten minutes paused
    expect(screen.getByRole("timer").textContent).toBe("23:59");
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await advance(60_000);
    expect(screen.getByRole("timer").textContent).toBe("22:59");
  });

  it("a long gap between paints (a sleeping tab) still shows the right time", async () => {
    render(ui());
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    // The clock jumps ten minutes at once, with no ticks in between.
    vi.setSystemTime(new Date(START.getTime() + 10 * 60_000));
    await advance(300);
    expect(screen.getByRole("timer").textContent).toBe("15:00");
  });

  it("ending the focus saves the session, moves to a break and shows it in the stats", async () => {
    const repo = new MemoryFocus();
    render(ui(repo));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await advance(25 * 60_000 + 500);
    expect(screen.getByText("Short break")).toBeTruthy();
    expect(repo.rows.size).toBe(1);
    expect([...repo.rows.values()][0]).toMatchObject({ status: "completed", focusSeconds: 1500 });

    // Break time is not study time.
    await advance(5 * 60_000 + 500);
    expect(repo.rows.size).toBe(1);

    fireEvent.click(screen.getByRole("radio", { name: "Stats" }));
    expect(screen.getByLabelText("Study time totals").textContent).toContain("25 min");
  });

  it("restores a running timer after a refresh", async () => {
    const repo = new MemoryFocus();
    const first = render(ui(repo));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await advance(5 * 60_000);
    first.unmount();
    await advance(30_000);
    render(ui(repo));
    await flush();
    expect(screen.getByRole("timer").textContent).toBe("19:30");
  });

  it("offers recovery after a long absence and can stop at the last seen time", async () => {
    const repo = new MemoryFocus();
    const first = render(ui(repo));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await advance(3 * 60_000);
    first.unmount();
    await advance(20 * 60_000);
    render(ui(repo));
    await flush();
    expect(screen.getByText("Your session was still running")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stop at last seen" }));
    await flush();
    expect(repo.rows.size).toBe(1);
    expect([...repo.rows.values()][0]!.focusSeconds).toBeLessThanOrEqual(3 * 60 + 15);
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("keyboard: space starts and pauses", async () => {
    render(ui());
    await flush();
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
  });

  it("the stopwatch counts up and Finish saves it", async () => {
    const repo = new MemoryFocus();
    render(ui(repo));
    await flush();
    fireEvent.click(screen.getByRole("radio", { name: "Stopwatch" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await advance(125_000);
    expect(screen.getByRole("timer").textContent).toBe("02:05");
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await flush();
    expect([...repo.rows.values()][0]).toMatchObject({
      kind: "stopwatch",
      status: "completed",
      focusSeconds: 125,
    });
  });

  it("shows an empty state, and history with delete", async () => {
    const repo = new MemoryFocus();
    const old: FocusRecord = {
      id: "11111111-1111-1111-1111-111111111111",
      kind: "pomodoro",
      status: "completed",
      startedAt: new Date(2026, 10, 25, 20, 0).toISOString(),
      endedAt: new Date(2026, 10, 25, 20, 25).toISOString(),
      focusSeconds: 1500,
      plannedSeconds: 1500,
      localDay: "2026-11-25",
    };
    render(ui(repo));
    await flush();
    fireEvent.click(screen.getByRole("radio", { name: "Stats" }));
    expect(screen.getByText("No study time yet")).toBeTruthy();
    cleanup();
    repo.rows.set(old.id, old);
    render(ui(repo));
    await flush();
    fireEvent.click(screen.getByRole("radio", { name: "History" }));
    expect(screen.getByText(/Completed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Delete session at/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete session" }));
    await flush();
    expect(repo.rows.size).toBe(0);
  });

  it("each student only sees their own timer", async () => {
    const a = render(ui(new MemoryFocus(), "u1"));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    a.unmount();
    render(ui(new MemoryFocus(), "u2"));
    await flush();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });
});

describe("full screen flip clock", () => {
  it("shows only the flipping time on black, flips a digit when it changes, and exits", async () => {
    render(ui());
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await advance(1_000);
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    const stage = screen.getByRole("region", { name: "Full screen timer" });
    expect(stage.className).toContain("flip-stage");
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("Time left 24:59");
    expect(stage.querySelectorAll("button")).toHaveLength(2); // Pause and Exit, hidden until tapped
    const before = stage.querySelectorAll(".flip-flap-top").length;
    expect(before).toBe(0);
    await advance(1_000);
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("Time left 24:58");
    expect(stage.querySelectorAll(".flip-flap-top").length).toBe(1); // only the changed digit flips
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(stage.querySelector('[data-paused="true"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(screen.queryByRole("region", { name: "Full screen timer" })).toBeNull();
  });
  it("splits hours into three groups", () => {
    expect(digitGroups("1:05:03")).toEqual([
      ["0", "1"],
      ["0", "5"],
      ["0", "3"],
    ]);
    expect(digitGroups("05:09")).toEqual([
      ["0", "5"],
      ["0", "9"],
    ]);
  });
});

describe("floating timer", () => {
  it("shows only while a session exists and can pause it", async () => {
    render(ui(new MemoryFocus(), "u1", true));
    await flush();
    expect(screen.queryByRole("group", { name: "Focus timer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    const pill = screen.getByRole("group", { name: "Focus timer" });
    expect(pill).toBeTruthy();
    const pause = Array.from(pill.querySelectorAll("button")).find(
      (b) => b.textContent === "Pause",
    )!;
    fireEvent.click(pause);
    expect(pill.textContent).toContain("paused");
  });
});
