import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Cricket from "./Cricket.tsx";

/*
 * Math.random is 0, so every ball waits 600 ms and arrives after 1300 - 60 * ballIndex ms.
 * Fake timers also fake Date, so a swing "late by N ms" is exact.
 */
const status = () => screen.getByTestId("status").textContent;
const field = () => screen.getByRole("button", { name: /Swing the bat/ });
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const click = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));

function setup() {
  const exit = vi.fn();
  const finish = vi.fn();
  render(<Cricket onExit={exit} onFinish={finish} />);
  return { exit, finish };
}
/** Starts a ball and moves the clock to the moment it reaches the ring (plus `late` ms). */
function bowl(index: number, late: number) {
  tick(600);
  expect(status()).toBe("Swing now!");
  tick(1300 - index * 60 + late);
}
const swing = () => fireEvent.pointerDown(field());

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Mini cricket screen", () => {
  it("waits for Start, then bowls after a short pause", () => {
    setup();
    expect(status()).toMatch(/Six balls, two wickets/);
    click("Start");
    expect(status()).toBe("Get ready…");
    tick(599);
    expect(status()).toBe("Get ready…");
    tick(1);
    expect(status()).toBe("Swing now!");
  });

  it("a swing as the ball reaches the ring is a six", () => {
    setup();
    click("Start");
    bowl(0, 0);
    swing();
    expect(status()).toBe("SIX!");
    expect(screen.getByTestId("runs").textContent).toBe("6");
  });

  it("a swing 150 ms late scores two runs", () => {
    setup();
    click("Start");
    bowl(0, 150);
    swing();
    expect(status()).toBe("Two runs");
    expect(screen.getByTestId("runs").textContent).toBe("2");
  });

  it("a tap while the bowler is still waiting does nothing", () => {
    setup();
    click("Start");
    tick(300);
    swing();
    expect(status()).toBe("Get ready…");
    tick(300);
    expect(status()).toBe("Swing now!");
  });

  it("the space key swings too", () => {
    setup();
    click("Start");
    bowl(0, 0);
    fireEvent.keyDown(field(), { key: " " });
    expect(status()).toBe("SIX!");
  });

  it("not swinging gets you bowled and costs a wicket", () => {
    setup();
    click("Start");
    tick(600);
    tick(1300 + 400);
    expect(status()).toBe("Bowled! You did not swing");
    expect(screen.getByTestId("wickets").textContent).toBe("1");
  });

  it("a second swing on the same ball counts for nothing", () => {
    setup();
    click("Start");
    bowl(0, 0);
    swing();
    swing();
    expect(screen.getByTestId("runs").textContent).toBe("6");
  });

  it("two wickets end the innings and the score is reported once", () => {
    const { finish } = setup();
    click("Start");
    tick(600);
    tick(1700);
    click("Next ball");
    tick(600);
    tick(1700);
    expect(screen.getByRole("button", { name: "See score" })).toBeTruthy();
    click("See score");
    expect(screen.getByTestId("final").textContent).toBe("0 runs");
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0]![0]).toMatchObject({ gameId: "cricket", score: 0 });
  });

  it("six perfect balls make 36 and a best score is kept", () => {
    const { finish } = setup();
    click("Start");
    for (let i = 0; i < 6; i++) {
      bowl(i, 0);
      swing();
      click(i === 5 ? "See score" : "Next ball");
      if (i < 5) {
        // next ball starts after Next ball; nothing else to do
      }
    }
    expect(screen.getByTestId("final").textContent).toBe("36 runs");
    expect(screen.getByText("Superstar innings")).toBeTruthy();
    expect(finish).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("learivo.cricket.best")).toBe("36");
  });

  it("Play again starts a fresh innings and reports the next one separately", () => {
    const { finish } = setup();
    click("Start");
    tick(600);
    tick(1700);
    click("Next ball");
    tick(600);
    tick(1700);
    click("See score");
    click("Play again");
    expect(screen.getByTestId("runs").textContent).toBe("0");
    expect(status()).toBe("Get ready…");
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("hiding the tab replays the ball instead of counting it", () => {
    setup();
    click("Start");
    tick(600);
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    spy.mockRestore();
    expect(status()).toBe("Get ready…");
    tick(5000);
    expect(screen.getByTestId("wickets").textContent).toBe("0");
  });

  it("Back to Break Room leaves the game", () => {
    const { exit } = setup();
    fireEvent.click(screen.getAllByRole("button", { name: /Break Room/ })[0]!);
    expect(exit).toHaveBeenCalled();
  });
});
