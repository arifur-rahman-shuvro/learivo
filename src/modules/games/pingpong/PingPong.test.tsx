import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PingPong from "./PingPong.tsx";

/*
 * Fake timers also fake Date and requestAnimationFrame, so frames come every 16 ms and the whole match
 * runs on the fake clock. Canvas is mocked away; the stage reports the paddles in data-p0 / data-p1.
 */
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const press = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const text = (id: string) => screen.getByTestId(id).textContent;
const stage = () => screen.getByRole("group", { name: /^Table/ });
const paddles = () => [Number(stage().dataset.p0), Number(stage().dataset.p1)];
const settingsKey = "learivo.pingpong.settings";
const saved = () => JSON.parse(window.localStorage.getItem(settingsKey)!);

function setup(preset?: Record<string, unknown>) {
  if (preset) window.localStorage.setItem(settingsKey, JSON.stringify(preset));
  const exit = vi.fn();
  const finish = vi.fn();
  render(<PingPong onExit={exit} onFinish={finish} />);
  return { exit, finish };
}
/** Plays with no fingers on the screen until `done` is true (or fails). */
function until(done: () => boolean, limitMs = 240000) {
  for (let t = 0; t < limitMs && !done(); t += 100) tick(100);
  expect(done()).toBe(true);
}
const start = () => {
  press(/Play$/);
  stage();
  vi.spyOn(stage(), "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 360,
    height: 600,
    right: 360,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
};
/** Table x (0..1) to a clientX on the 360 px wide picture. */
const cx = (tx: number) => 20 + tx * 320;
const down = (id: number, tx: number, ny: number) =>
  fireEvent.pointerDown(stage(), { pointerId: id, clientX: cx(tx), clientY: ny * 600 });
const move = (id: number, tx: number) =>
  fireEvent.pointerMove(stage(), { pointerId: id, clientX: cx(tx), clientY: 300 });

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Mini table tennis home", () => {
  it("offers the modes, levels, targets and Play", () => {
    setup();
    for (const n of [
      "Vs Computer",
      "2 Players",
      "Practice",
      "Easy",
      "Normal",
      "Hard",
      "Expert",
      "Single set",
      "Best of 3",
      "Best of 5",
      "Statistics",
      "How to play",
      "Settings",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${n}`) })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: /Play$/ })).toBeTruthy();
  });
  it("remembers the chosen mode, level and rules", () => {
    setup();
    press(/2 Players/);
    expect(saved().mode).toBe("local");
    press(/^Practice/);
    press("Fast");
    expect(saved()).toMatchObject({ mode: "practice", practiceSpeed: "fast" });
    press(/Vs Computer/);
    press("Expert");
    press("7");
    press("Best of 5");
    expect(saved()).toMatchObject({ mode: "ai", level: "expert", target: 7, bestOf: 5 });
  });
  it("starts with the saved settings after a reload", () => {
    setup({ mode: "ai", level: "hard", target: 21, bestOf: 3 });
    expect(screen.getByRole("button", { name: /^Hard/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "21" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("ignores damaged saved settings", () => {
    window.localStorage.setItem(settingsKey, "{not json");
    setup();
    expect(screen.getByRole("button", { name: /^Normal/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
  it("settings: sound, volume, vibration, sensitivity and theme are saved", () => {
    setup();
    press("Settings");
    const group = (name: string) => screen.getByRole("group", { name });
    fireEvent.click(group("Sound").querySelectorAll("button")[1]!);
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "30" } });
    fireEvent.click(group("Vibration").querySelectorAll("button")[1]!);
    fireEvent.change(screen.getByRole("slider", { name: "Paddle sensitivity" }), {
      target: { value: "140" },
    });
    press("Forest");
    expect(saved()).toMatchObject({
      sound: false,
      volume: 0.3,
      vibration: false,
      sensitivity: 1.4,
      theme: "forest",
    });
  });
  it("a saved volume outside 0 to 100 is brought back into range", () => {
    setup({ volume: 5 });
    press("Settings");
    expect((screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement).value).toBe("100");
  });
  it("Back goes to the Break Room", () => {
    const { exit } = setup();
    fireEvent.click(screen.getAllByRole("button", { name: /Break Room/ })[0]!);
    expect(exit).toHaveBeenCalled();
  });
});

describe("a match against the computer", () => {
  it("counts down, serves, and the computer scores when you do not move", () => {
    setup({ mode: "ai", level: "normal", target: 5 });
    start();
    expect(text("score-0")).toBe("0");
    expect(text("score-1")).toBe("0");
    until(() => text("score-0") !== "0" || text("score-1") !== "0");
    expect(Number(text("score-0")) + Number(text("score-1"))).toBe(1);
  });
  it("a finished match shows the winner, keeps the records and reports once", () => {
    const { finish } = setup({ mode: "ai", level: "easy", target: 5 });
    start();
    until(() => screen.queryByTestId("result") !== null);
    expect(text("winner")).toMatch(/You win!|You lose/);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0]![0]).toMatchObject({ gameId: "pingpong" });
    const rec = JSON.parse(window.localStorage.getItem("learivo.pingpong.stats")!);
    expect(rec.ai.easy.won + rec.ai.easy.lost).toBe(1);
    // the record matches the winner shown on the screen
    expect(rec.ai.easy.won).toBe(text("winner") === "You win!" ? 1 : 0);
    tick(5000);
    expect(finish).toHaveBeenCalledTimes(1);
  });
  it("Rematch starts a fresh match at 0 - 0", () => {
    setup({ mode: "ai", level: "easy", target: 5 });
    start();
    until(() => screen.queryByTestId("result") !== null);
    press("Rematch");
    expect(text("score-0")).toBe("0");
    expect(text("score-1")).toBe("0");
    expect(screen.queryByTestId("result")).toBeNull();
  });
});

describe("two players on one phone", () => {
  it("two fingers move the two paddles at the same time", () => {
    setup({ mode: "local" });
    start();
    tick(100);
    down(1, 0.2, 0.9); // lower half: player 1
    down(2, 0.8, 0.1); // upper half: player 2
    tick(700);
    const [a, b] = paddles();
    expect(a).toBeLessThan(0.35);
    expect(b).toBeGreaterThan(0.65);
    move(1, 0.7);
    move(2, 0.3);
    tick(800);
    const [c, d] = paddles();
    expect(c).toBeGreaterThan(0.6);
    expect(d).toBeLessThan(0.4);
  });
  it("the sensitivity setting decides how far a slide moves the paddle", () => {
    const reach = (sensitivity: number) => {
      setup({ mode: "local", sensitivity });
      start();
      tick(100);
      down(1, 0.5, 0.9);
      move(1, 0.7);
      tick(900);
      const x = paddles()[0]!;
      cleanup();
      window.localStorage.clear();
      return x;
    };
    const low = reach(0.9);
    const high = reach(1.5);
    expect(low).toBeCloseTo(0.5 + 0.2 * 0.9, 1);
    expect(high).toBeCloseTo(0.5 + 0.2 * 1.5, 1);
  });
  it("a finger that wanders over the middle keeps its own paddle", () => {
    setup({ mode: "local" });
    start();
    tick(100);
    down(1, 0.5, 0.9);
    fireEvent.pointerMove(stage(), { pointerId: 1, clientX: cx(0.15), clientY: 100 }); // now in the top half
    tick(800);
    const [a, b] = paddles();
    expect(a).toBeLessThan(0.3);
    expect(b).toBeCloseTo(0.5, 1);
  });
  it("a second finger on the same half does not take the paddle", () => {
    setup({ mode: "local" });
    start();
    tick(100);
    down(1, 0.2, 0.9);
    down(2, 0.9, 0.9);
    move(2, 0.9);
    tick(800);
    expect(paddles()[0]).toBeLessThan(0.35);
  });
  it("a cancelled touch frees the paddle for the next finger", () => {
    setup({ mode: "local" });
    start();
    tick(100);
    down(1, 0.2, 0.9);
    fireEvent.pointerCancel(stage(), { pointerId: 1 });
    down(5, 0.85, 0.9);
    tick(800);
    expect(paddles()[0]).toBeGreaterThan(0.65);
  });
  it("shows the top player's bar upside down and names both players", () => {
    setup({ mode: "local" });
    start();
    expect(screen.getByTestId("hud-1").className).toMatch(/pp-flip/);
    expect(screen.getByTestId("hud-0").className).not.toMatch(/pp-flip/);
    expect(screen.getByText("Player 1")).toBeTruthy();
    expect(screen.getByText("Player 2")).toBeTruthy();
  });
  it("a finished match counts as a 2 Player match", () => {
    setup({ mode: "local", target: 5 });
    start();
    until(() => screen.queryByTestId("result") !== null);
    expect(text("winner")).toMatch(/Player [12] wins!/);
    const rec = JSON.parse(window.localStorage.getItem("learivo.pingpong.stats")!);
    expect(rec.localMatches).toBe(1);
  });
});

describe("pause and restart", () => {
  it("Pause stops the ball and Resume carries on", () => {
    setup({ mode: "ai", level: "normal", target: 11 });
    start();
    tick(3500);
    press("Pause");
    expect(screen.getByTestId("pause")).toBeTruthy();
    const before = [text("score-0"), text("score-1")];
    tick(20000);
    expect([text("score-0"), text("score-1")]).toEqual(before);
    press("Resume");
    expect(screen.queryByTestId("pause")).toBeNull();
  });
  it("a hidden tab pauses the match", () => {
    setup({ mode: "ai" });
    start();
    tick(500);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByTestId("pause")).toBeTruthy();
  });
  it("Escape pauses and resumes", () => {
    setup({ mode: "ai" });
    start();
    tick(500);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("pause")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("pause")).toBeNull();
  });
  it("Restart starts again at 0 - 0 and Main menu goes home", () => {
    setup({ mode: "ai", level: "easy", target: 5 });
    start();
    until(() => text("score-0") !== "0" || text("score-1") !== "0");
    press("Pause");
    press("Restart");
    expect(text("score-0")).toBe("0");
    expect(text("score-1")).toBe("0");
    press("Pause");
    press("Main menu");
    expect(screen.getByRole("button", { name: /Play$/ })).toBeTruthy();
  });
  it("the keyboard moves the paddles: arrows for player 1, A and D for player 2", () => {
    setup({ mode: "local" });
    start();
    tick(100);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "d" });
    tick(700);
    fireEvent.keyUp(window, { key: "ArrowLeft" });
    fireEvent.keyUp(window, { key: "d" });
    const [a, b] = paddles();
    expect(a).toBeLessThan(0.4);
    expect(b).toBeGreaterThan(0.6);
  });
});

describe("practice and statistics", () => {
  it("practice has no score, only a rally counter, and the wall sends the ball back", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    setup({ mode: "practice" });
    start();
    expect(screen.getByTestId("hud-practice")).toBeTruthy();
    expect(screen.queryByTestId("score-0")).toBeNull();
    down(1, 0.5, 0.9);
    tick(12000);
    expect(Number(text("rally"))).toBeGreaterThanOrEqual(2);
    expect(Number(text("best-rally"))).toBeGreaterThanOrEqual(Number(text("rally")));
  });
  it("Statistics shows what was saved and can be erased", () => {
    window.localStorage.setItem(
      "learivo.pingpong.stats",
      JSON.stringify({ ai: { hard: { won: 3, lost: 2 } }, localMatches: 4, longestRally: 17 }),
    );
    setup();
    press("Statistics");
    expect(text("won-hard")).toBe("3");
    expect(text("lost-hard")).toBe("2");
    expect(text("local-matches")).toBe("4");
    expect(text("longest")).toBe("17");
    press("Reset statistics");
    expect(text("longest")).toBe("17");
    press("Tap again to erase");
    expect(text("longest")).toBe("0");
    expect(text("won-hard")).toBe("0");
  });
  it("damaged saved statistics read as zero", () => {
    window.localStorage.setItem("learivo.pingpong.stats", "oops");
    setup();
    press("Statistics");
    expect(text("longest")).toBe("0");
  });
});
