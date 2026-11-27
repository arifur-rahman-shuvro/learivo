import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Penalty from "./Penalty.tsx";

const status = () => screen.getByTestId("status").textContent;
const goals = (side: "you" | "bot") => screen.getByTestId(`${side}-goals`).textContent;
const shoot = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const next = () => fireEvent.click(screen.getByRole("button", { name: /Next kick|See result/ }));

/** Makes every dice roll the same number. 0.999 means: no miss, no save, a goal for the shooter. */
function dice(...v: number[]) {
  let i = 0;
  vi.spyOn(Math, "random").mockImplementation(() => v[Math.min(i++, v.length - 1)]!);
}

function setup() {
  const exit = vi.fn();
  const finish = vi.fn();
  render(<Penalty onExit={exit} onFinish={finish} />);
  return { exit, finish };
}

beforeEach(() => vi.restoreAllMocks());
afterEach(cleanup);

describe("Penalty shootout screen", () => {
  it("starts with your kick, six goal spots and a power choice defaulting to Medium", () => {
    setup();
    expect(status()).toBe("Your kick: tap a spot in the goal");
    expect(screen.getAllByRole("button", { name: /^Shoot / })).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Medium" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Hard" }));
    expect(screen.getByRole("button", { name: "Hard" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("a goal is announced and counted, then the bot shoots and you choose where to dive", () => {
    dice(0.999);
    setup();
    shoot("Shoot Top left");
    expect(status()).toBe("Goal!");
    expect(goals("you")).toBe("1");
    // spots are locked while the result is shown
    expect(
      screen.getByRole("button", { name: "Shoot Top left" }).getAttribute("aria-disabled"),
    ).toBe("true");
    shoot("Shoot Top middle"); // a second tap during the result counts for nothing
    expect(goals("you")).toBe("1");
    expect(status()).toBe("Goal!");
    next();
    expect(status()).toBe("Bot's kick: tap where to dive");
    expect(screen.getAllByRole("button", { name: /^Dive / })).toHaveLength(6);
    expect(screen.queryByRole("group", { name: "Shot power" })).toBeNull();
  });

  it("the keeper can save your shot and you can save the bot's", () => {
    // dice order for your kick: keeper's dive (0 = Top left), miss roll (0.5 = no miss), save roll (0.1 = saved)
    dice(0, 0.5, 0.1);
    setup();
    shoot("Shoot Top left");
    expect(status()).toBe("Saved by the keeper");
    expect(goals("you")).toBe("0");
  });

  it("a miss is a miss, not a goal", () => {
    // keeper dives to the last zone, then the miss roll 0 is under the 15% chance of a hard shot
    dice(0.999, 0);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Hard" }));
    shoot("Shoot Top right");
    expect(status()).toBe("Missed, it flew wide or over");
    expect(goals("you")).toBe("0");
  });

  it("plays a whole shootout to the end, reports it once, and Play again starts fresh", () => {
    dice(0.999); // every dice roll high: the keeper dives to the last zone and every shot scores
    const { finish } = setup();
    // you 5 - 5 bot: every kick scores, so after five each it is a tie and sudden death follows;
    // end it by making the bot miss: after that the dice are low and everything misses for the bot.
    for (let i = 0; i < 5; i++) {
      shoot("Shoot Top left");
      next();
      shoot("Dive Top left");
      next();
    }
    expect(screen.getByText("Sudden death")).toBeTruthy();
    expect(finish).not.toHaveBeenCalled();
    // sudden death: you score; then every roll is 0, so the bot shoots Top left softly and you saved it
    shoot("Shoot Top left");
    next();
    vi.spyOn(Math, "random").mockReturnValue(0);
    shoot("Dive Top left");
    expect(status()).toBe("You saved it!"); // the bot aims at a corner and you dived to Top left
    expect(screen.getByRole("button", { name: "See result" })).toBeTruthy();
    next();
    expect(status()).toBe("You win 6 to 5");
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0]![0]).toMatchObject({ gameId: "penalty", score: 6 });
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(status()).toBe("Your kick: tap a spot in the goal");
    expect(goals("you")).toBe("0");
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("ends early when the bot cannot catch up, and Back goes to the Break Room", () => {
    dice(0.999);
    const { exit } = setup();
    // you score 3, the bot misses 2... make the bot miss by switching the dice to 0 on its turns
    for (let i = 0; i < 3; i++) {
      vi.spyOn(Math, "random").mockReturnValue(0.999);
      shoot("Shoot Top left");
      next();
      vi.spyOn(Math, "random").mockReturnValue(0);
      shoot("Dive Top left");
      if (i < 2) next();
    }
    // you 3, bot 0 after three each: bot has two left and cannot reach 3
    expect(screen.getByRole("button", { name: "See result" })).toBeTruthy();
    next();
    expect(status()).toBe("You win 3 to 0");
    fireEvent.click(screen.getByRole("button", { name: "Back to Break Room" }));
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
