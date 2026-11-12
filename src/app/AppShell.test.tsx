import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../themes/ThemeProvider.tsx";
import AppShell from "./AppShell.tsx";

const renderShell = () =>
  render(
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>,
  );

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("AppShell", () => {
  it("shows Home with the five navigation items by default", () => {
    renderShell();
    expect(
      screen.getByRole("heading", { level: 1, name: "Your question bank starts here" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.querySelectorAll("button").length).toBe(5);
  });

  it("follows the URL hash", () => {
    window.location.hash = "#/practice";
    renderShell();
    expect(screen.getByRole("heading", { level: 1, name: "Practice" })).toBeTruthy();
  });

  it("navigates when a destination is tapped", () => {
    renderShell();
    act(() => {
      screen.getByRole("button", { name: "Insights" }).click();
    });
    expect(window.location.hash).toBe("#/insights");
  });
});
