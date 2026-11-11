import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Badge, Button, Card, EmptyState, Field, ProgressBar, ProgressRing } from "./components.tsx";
import { ThemeSwitcher } from "./ThemeSwitcher.tsx";
import { ThemeProvider } from "../themes/ThemeProvider.tsx";

function renderWithTheme(ui: React.ReactNode) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-mode");
  // jsdom has no matchMedia
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

describe("ThemeProvider and ThemeSwitcher", () => {
  it("applies default theme and light mode to the document", () => {
    renderWithTheme(<ThemeSwitcher />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("default");
    expect(document.documentElement.getAttribute("data-mode")).toBe("light");
  });

  it("switches theme, applies it to the document and remembers it", () => {
    renderWithTheme(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("radio", { name: "Forest" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("forest");
    expect(localStorage.getItem("learivo.theme")).toBe("forest");
  });

  it("restores a saved theme on load", () => {
    localStorage.setItem("learivo.theme", "space");
    renderWithTheme(<ThemeSwitcher />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("space");
  });

  it("ignores an invalid saved theme", () => {
    localStorage.setItem("learivo.theme", "hacked");
    renderWithTheme(<ThemeSwitcher />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("default");
  });

  it("forces dark mode in Space, which has no light mode", () => {
    renderWithTheme(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    fireEvent.click(screen.getByRole("radio", { name: "Space" }));
    expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
    expect(screen.getByRole("radio", { name: "Dark" }).hasAttribute("disabled")).toBe(true);
  });

  it("lets a mode choice persist", () => {
    renderWithTheme(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
    expect(localStorage.getItem("learivo.mode")).toBe("dark");
  });
});

describe("components", () => {
  it("Button fires onClick and is disabled while loading", () => {
    let clicks = 0;
    renderWithTheme(
      <>
        <Button onClick={() => clicks++}>Go</Button>
        <Button loading>Busy</Button>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(clicks).toBe(1);
    const busy = screen.getByRole("button", { name: /Busy/ });
    expect(busy.hasAttribute("disabled")).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
  });

  it("Field links label, hint and error for screen readers", () => {
    renderWithTheme(<Field label="Email" hint="Helpful hint" error="Bad email" />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Bad email");
    expect(input.getAttribute("aria-describedby")).toContain("error");
  });

  it("Progress components clamp values and expose them accessibly", () => {
    renderWithTheme(
      <>
        <ProgressRing value={150} label="Ring" />
        <ProgressBar value={-20} label="Bar" />
      </>,
    );
    expect(screen.getByRole("progressbar", { name: "Ring" }).getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByRole("progressbar", { name: "Bar" }).getAttribute("aria-valuenow")).toBe("0");
  });

  it("EmptyState renders title, description and action", () => {
    renderWithTheme(<EmptyState title="Nothing" description="Add something" action={<Button>Add</Button>} />);
    expect(screen.getByText("Nothing")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("Card and Badge render children", () => {
    renderWithTheme(
      <Card>
        <Badge tone="success">Correct</Badge>
      </Card>,
    );
    expect(screen.getByText("Correct")).toBeTruthy();
  });
});
