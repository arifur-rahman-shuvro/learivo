import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../themes/ThemeProvider.tsx";
import AppShell from "./AppShell.tsx";
import { AuthProvider } from "../auth/AuthProvider.tsx";
import { fakeAuth } from "../test/fakeAuth.ts";

const renderShell = () =>
  render(
    <ThemeProvider>
      <AuthProvider client={fakeAuth({ id: "u1", email: "sara@example.test" })}>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>,
  );

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("AppShell", () => {
  it("shows Home with the five navigation items by default", async () => {
    renderShell();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Your question bank starts here" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.querySelectorAll("button").length).toBe(5);
  });

  it("follows the URL hash", async () => {
    window.location.hash = "#/practice";
    renderShell();
    expect(await screen.findByRole("heading", { level: 1, name: "Practice" })).toBeTruthy();
  });

  it("navigates when a destination is tapped", async () => {
    renderShell();
    await screen.findByRole("navigation", { name: "Primary" });
    act(() => {
      screen.getByRole("button", { name: "Insights" }).click();
    });
    expect(window.location.hash).toBe("#/insights");
  });
});
