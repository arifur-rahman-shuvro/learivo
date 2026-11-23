import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../feedback/EmptyState.tsx";
import { ThemeProvider } from "../themes/ThemeProvider.tsx";
import { CaughtUpScene, ErrorScene, QuestionsScene } from "./Scenes.tsx";

describe("scenes", () => {
  it("are decorative and use only theme colours", () => {
    for (const Scene of [QuestionsScene, CaughtUpScene, ErrorScene]) {
      const { container } = render(<Scene />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      const paints = [...container.querySelectorAll("[fill],[stroke]")].flatMap((el) => [
        el.getAttribute("fill"),
        el.getAttribute("stroke"),
      ]);
      for (const p of paints) {
        if (p && p !== "none") expect(p).toMatch(/^var\(--lv-/);
      }
    }
  });

  it("replace the icon in an empty state when passed as art", () => {
    const { container } = render(
      <ThemeProvider>
        <EmptyState
          title="T"
          description="D"
          icon={<i data-testid="icon" />}
          art={<QuestionsScene />}
        />
      </ThemeProvider>,
    );
    expect(container.querySelector("[data-testid=icon]")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
