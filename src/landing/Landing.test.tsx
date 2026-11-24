import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../ui-kit/themes/ThemeProvider.tsx";
import Landing from "./Landing.tsx";

afterEach(cleanup);

function show(onCreate = vi.fn(), onSignIn = vi.fn()) {
  render(
    <ThemeProvider>
      <Landing onCreate={onCreate} onSignIn={onSignIn} />
    </ThemeProvider>,
  );
  return { onCreate, onSignIn };
}

describe("Landing", () => {
  it("has a page menu and both ways in at the top", () => {
    const { onCreate, onSignIn } = show();
    const nav = screen.getByRole("navigation", { name: "Page sections" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")),
    ).toEqual(["#lp-tour", "#lp-pace", "#lp-look", "#lp-faq"]);
    // Every menu target exists.
    for (const a of within(nav).getAllByRole("link")) {
      expect(document.getElementById(a.getAttribute("href")!.slice(1))).toBeTruthy();
    }
    fireEvent.click(screen.getAllByRole("button", { name: "Sign in" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Create account" })[0]!);
    expect(onSignIn).toHaveBeenCalled();
    expect(onCreate).toHaveBeenCalled();
  });

  it("test builder: summary follows the choices", () => {
    const { onCreate } = show();
    const status = () => screen.getByText(/questions from/).closest("p")!.textContent!;
    expect(status()).toContain("20 questions from 2 subjects");
    expect(status()).toContain("not tried");
    expect(status()).toContain("after each question");
    fireEvent.click(screen.getByRole("button", { name: "Physiology" }));
    expect(status()).toContain("from Pharmacology");
    fireEvent.click(screen.getByRole("button", { name: "Pharmacology" }));
    expect(status()).toContain("from every subject");
    fireEvent.change(screen.getByLabelText(/Number of questions/), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("radio", { name: "Timed" }));
    expect(status()).toContain("40 questions");
    expect(status()).toContain("60-minute timer");
    fireEvent.click(screen.getByRole("radio", { name: "Mistakes" }));
    expect(status()).toContain("your mistakes");
    fireEvent.click(screen.getByRole("button", { name: "Build your own test" }));
    expect(onCreate).toHaveBeenCalled();
  });

  it("tabs switch with the arrow keys and show one panel at a time", () => {
    show();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Sit an exam/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Sit an exam/ }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /Build a test/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("exam navigator: a tap cycles a question and the counts follow", () => {
    show();
    fireEvent.click(screen.getByRole("tab", { name: /Sit an exam/ }));
    const counts = () => within(screen.getByRole("tabpanel")).getByRole("status").textContent!;
    expect(counts()).toBe("18 answered, 3 flagged, 19 left");
    fireEvent.click(screen.getByRole("button", { name: "Question 8, not answered" }));
    expect(counts()).toBe("19 answered, 3 flagged, 18 left");
    fireEvent.click(screen.getByRole("button", { name: "Question 8, answered" }));
    expect(counts()).toBe("18 answered, 4 flagged, 18 left");
    fireEvent.click(screen.getByRole("button", { name: "Focus on flagged" }));
    expect(screen.getByRole("button", { name: "Show all" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("insights: orders by weakest, and explains an area when tapped", () => {
    show();
    fireEvent.click(screen.getByRole("tab", { name: /Find weak areas/ }));
    const names = () =>
      within(screen.getByRole("tabpanel"))
        .getAllByRole("listitem")
        .map((li) => li.textContent ?? "");
    expect(names()[0]).toContain("Pharmacology: antimicrobials");
    fireEvent.click(screen.getByRole("button", { name: /^Cardiology/ }));
    expect(screen.getByText(/Cardiology: 82% over 140 answers. Above 70%/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "A to Z" }));
    expect(names()[0]).toContain("Biochemistry");
  });

  it("revision: shows the answer, then when the card comes back", () => {
    show();
    fireEvent.click(screen.getByRole("tab", { name: /Revise/ }));
    expect(screen.queryByText(/Ethosuximide/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByText(/Ethosuximide/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hard" }));
    expect(screen.getByText(/comes back in/).textContent).toContain("2 days");
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByText(/foramen rotundum/)).toBeTruthy();
  });

  it("answers the questions people ask", () => {
    show();
    const rows = document.querySelectorAll(".lp-faq details");
    expect(rows.length).toBe(6);
    expect(screen.getByText("Does it work without internet?")).toBeTruthy();
  });
});
