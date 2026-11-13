import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_LAYOUT,
  cleanLayout,
  moveSection,
  toggleSection,
  visibleSections,
} from "./homeLayout.ts";

describe("home layout", () => {
  it("turns empty or broken stored data into the default", () => {
    for (const raw of [undefined, null, {}, [], "x", 5, { order: "no", hidden: 7 }]) {
      expect(cleanLayout(raw)).toEqual(DEFAULT_HOME_LAYOUT);
    }
  });

  it("drops unknown and repeated sections and appends missing ones", () => {
    const l = cleanLayout({
      order: ["goal", "bogus", "goal", "focus"],
      hidden: ["weak", "weak", "x"],
    });
    expect(l.order).toEqual(["goal", "focus", "numbers", "weak", "recent"]);
    expect(l.hidden).toEqual(["weak"]);
  });

  it("moves sections and stops at the ends", () => {
    const up = moveSection(DEFAULT_HOME_LAYOUT, "goal", -1);
    expect(up.order.slice(0, 3)).toEqual(["focus", "goal", "numbers"]);
    expect(moveSection(DEFAULT_HOME_LAYOUT, "focus", -1)).toBe(DEFAULT_HOME_LAYOUT);
    expect(moveSection(DEFAULT_HOME_LAYOUT, "recent", 1)).toBe(DEFAULT_HOME_LAYOUT);
  });

  it("hides and shows sections", () => {
    const hidden = toggleSection(DEFAULT_HOME_LAYOUT, "weak");
    expect(visibleSections(hidden)).not.toContain("weak");
    expect(visibleSections(toggleSection(hidden, "weak"))).toContain("weak");
  });
});
