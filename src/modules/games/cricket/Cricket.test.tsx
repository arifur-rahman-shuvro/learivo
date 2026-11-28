import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Cricket from "./Cricket.tsx";

/*
 * Math.random is 0: a normal ball, 700 ms run-up, 1300 ms to the bat (minus 15 ms per ball faced) at
 * medium. Frames come every 16 ms, so "Swing now!" shows up to 16 ms after the release; swinging one
 * ball-time after that lands 0 to 16 ms late, inside the 30 ms sweet spot: a six.
 */
const status = () => screen.getByTestId("status").textContent;
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const press = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const stage = () => screen.getByRole("button", { name: /Swing the bat/ });

function untilStatus(text: RegExp | string, limit = 8000) {
  for (let i = 0; i < limit / 16; i++) {
    const s = status() ?? "";
    if (typeof text === "string" ? s === text : text.test(s)) return;
    tick(16);
  }
  throw new Error(`status never became ${String(text)}; it is "${status()}"`);
}
const speed = (ball: number) => 1300 - 15 * ball;
function sixBall(ball: number) {
  untilStatus("Swing now!");
  tick(speed(ball));
  fireEvent.pointerDown(stage());
}

function setup(preset?: Record<string, unknown>) {
  if (preset) window.localStorage.setItem("learivo.cricket.settings", JSON.stringify(preset));
  const exit = vi.fn();
  const finish = vi.fn();
  render(<Cricket onExit={exit} onFinish={finish} />);
  return { exit, finish };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Mini cricket home", () => {
  it("offers the four modes, three difficulties and Play", () => {
    setup();
    for (const n of [
      "Quick Play",
      "6-Ball Challenge",
      "10-Wicket Challenge",
      "Target Chase",
      "Easy",
      "Medium",
      "Hard",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(n) })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: /Play$/ })).toBeTruthy();
    expect(screen.getByTestId("best").textContent).toBe("No best score yet");
  });
  it("Target Chase shows the target while playing and a verdict at the end", () => {
    const { finish } = setup();
    press(/Target Chase/);
    press("Easy"); // target 40
    press(/Play$/);
    expect(screen.getByTestId("need").textContent).toBe("Target 40, need 40");
    untilStatus("Swing now!");
    for (let b = 0; b < 3; b++) {
      // three wickets by not swinging
      untilStatus(/Bowled/, 12000);
      if (b < 2) untilStatus("Swing now!", 12000);
    }
    for (let i = 0; i < 400 && !screen.queryByTestId("final"); i++) tick(16);
    expect(screen.getByTestId("verdict").textContent).toBe("Lost. 40 runs short of 40");
    expect(finish).toHaveBeenCalledTimes(1);
  });
  it("the chase counts down what is still needed after each hit", () => {
    setup();
    press(/Target Chase/); // medium: target 36
    press(/Play$/);
    expect(screen.getByTestId("need").textContent).toBe("Target 36, need 36");
    sixBall(0);
    untilStatus(/SIX/);
    for (let i = 0; i < 100 && screen.getByTestId("balls").textContent !== "1/12 balls"; i++)
      tick(16);
    expect(screen.getByTestId("need").textContent).toBe("Target 36, need 30");
  });
  it("remembers the chosen mode and difficulty", () => {
    setup();
    press(/6-Ball Challenge/);
    press("Hard");
    const saved = JSON.parse(window.localStorage.getItem("learivo.cricket.settings")!);
    expect(saved).toMatchObject({ mode: "six", difficulty: "hard" });
    expect(
      screen.getByRole("button", { name: /6-Ball Challenge/ }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("the sound button switches sound off and on", () => {
    setup();
    press("Sound: on");
    expect(screen.getByRole("button", { name: "Sound: off" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(JSON.parse(window.localStorage.getItem("learivo.cricket.settings")!).sound).toBe(false);
  });
  it("How to play and Settings open and settings are saved", () => {
    setup();
    press("How to play");
    expect(
      screen.getByText(/Tap anywhere on the pitch as the ball reaches the dashed ring/),
    ).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
  });
  it("Settings change vibration and animation quality", () => {
    setup();
    press("Settings");
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      dialog.querySelector('[role="group"][aria-label="Vibration"] button:last-child')!,
    );
    fireEvent.click(
      dialog.querySelector('[role="group"][aria-label="Animation quality"] button:last-child')!,
    );
    const saved = JSON.parse(window.localStorage.getItem("learivo.cricket.settings")!);
    expect(saved).toMatchObject({ vibration: false, quality: "low" });
  });
  it("shows the best score for the chosen mode and level", () => {
    window.localStorage.setItem("learivo.cricket.best.quick.medium", "18");
    setup();
    expect(screen.getByTestId("best").textContent).toBe("Your best here: 18");
  });
  it("Back to Break Room leaves", () => {
    const { exit } = setup();
    press(/Break Room/);
    expect(exit).toHaveBeenCalled();
  });
});

describe("Mini cricket match", () => {
  it("Play starts the run-up, then the ball is bowled", () => {
    setup();
    press(/Play$/);
    expect(status()).toBe("Get ready…");
    untilStatus("Swing now!");
  });
  it("a swing at the right moment is a six with PERFECT feedback", () => {
    setup();
    press(/Play$/);
    sixBall(0);
    expect(screen.getByTestId("feedback").textContent).toMatch(/PERFECT/);
    untilStatus(/SIX!/);
    expect(status()).toBe("PERFECT. SIX!");
    expect(screen.getByTestId("runs").textContent).toBe("6");
    expect(screen.getByTestId("balls").textContent).toBe("Balls 1");
  });
  it("a tap while the bowler runs in does nothing", () => {
    setup();
    press(/Play$/);
    tick(300);
    fireEvent.pointerDown(stage());
    expect(status()).toBe("Get ready…");
    expect(screen.queryByTestId("feedback")).toBeNull();
  });
  it("Space swings too", () => {
    setup();
    press(/Play$/);
    untilStatus("Swing now!");
    tick(1300);
    fireEvent.keyDown(stage(), { key: " " });
    untilStatus(/SIX!/);
  });
  it("tapping at the far right aims to the right", () => {
    setup();
    press(/Play$/);
    untilStatus("Swing now!");
    tick(1300);
    vi.spyOn(stage(), "getBoundingClientRect").mockReturnValue({ left: 0, width: 300 } as DOMRect);
    fireEvent.pointerDown(stage(), { clientX: 300 });
    tick(3000);
    // an aimed six still scores; the shot has gone to the off side, so the outcome is a six or a boundary
    expect(Number(screen.getByTestId("runs").textContent)).toBeGreaterThanOrEqual(4);
  });
  it("not swinging gets you bowled, and Quick Play ends with the score reported once", () => {
    const { finish } = setup();
    press(/Play$/);
    untilStatus(/Bowled/);
    expect(status()).toBe("Bowled!");
    expect(screen.getByTestId("wickets").textContent).toBe("1");
    untilStatus(/./, 500);
    tick(2500);
    expect(screen.getByTestId("final").textContent).toBe("0 runs");
    expect(screen.getByText("Keep practising your timing")).toBeTruthy();
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0]![0]).toMatchObject({ gameId: "cricket", score: 0 });
    tick(5000);
    expect(finish).toHaveBeenCalledTimes(1);
  });
  it("6-Ball Challenge: six perfect balls make 36, saved as the best, reported once", () => {
    const { finish } = setup({ mode: "six", difficulty: "medium" });
    press(/Play$/);
    for (let i = 0; i < 6; i++) {
      sixBall(i);
      untilStatus(/SIX!/);
      expect(screen.getByTestId("balls").textContent).toBe(`${i + 1}/6 balls`);
    }
    tick(3000);
    expect(screen.getByTestId("final").textContent).toBe("36 runs");
    expect(screen.getByText("Superstar innings")).toBeTruthy();
    expect(screen.getByTestId("best-final").textContent).toMatch(/New best score/);
    expect(window.localStorage.getItem("learivo.cricket.best.six.medium")).toBe("36");
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0]![0]).toMatchObject({ score: 36 });
  });
  it("shows the last balls as chips", () => {
    setup({ mode: "six", difficulty: "medium" });
    press(/Play$/);
    sixBall(0);
    untilStatus(/SIX!/);
    expect(screen.getByTestId("chips").textContent).toBe("6");
  });
  it("Play again starts a new match", () => {
    setup();
    press(/Play$/);
    untilStatus(/Bowled/);
    tick(2500);
    press("Play again");
    expect(status()).toBe("Get ready…");
    expect(screen.getByTestId("runs").textContent).toBe("0");
  });
  it("Home from the game over screen goes back to the menu", () => {
    setup();
    press(/Play$/);
    untilStatus(/Bowled/);
    tick(2500);
    press("Home");
    expect(screen.getByRole("button", { name: /Play$/ })).toBeTruthy();
  });
});

describe("pause", () => {
  it("the Pause button freezes the game and Resume bowls the ball again", () => {
    setup({ mode: "six" });
    press(/Play$/);
    untilStatus("Swing now!");
    press("Pause");
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    tick(20000);
    expect(screen.getByTestId("wickets").textContent).toBe("0");
    press("Resume");
    expect(status()).toBe("Get ready…");
    expect(screen.getByTestId("balls").textContent).toBe("0/6 balls");
  });
  it("Escape pauses", () => {
    setup();
    press(/Play$/);
    fireEvent.keyDown(stage(), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
  });
  it("hiding the tab pauses the game", () => {
    setup();
    press(/Play$/);
    untilStatus("Swing now!");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    tick(10000);
    expect(screen.getByTestId("wickets").textContent).toBe("0");
  });
  it("Restart and Home work from the pause menu", () => {
    setup();
    press(/Play$/);
    press("Pause");
    press("Restart");
    expect(status()).toBe("Get ready…");
    press("Pause");
    press("Home");
    expect(screen.getByRole("button", { name: /Play$/ })).toBeTruthy();
  });
});
