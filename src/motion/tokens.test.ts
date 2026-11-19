import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { motionToCss } from "./tokens.ts";

describe("motion tokens", () => {
  it("defines every --lv-m-* variable the animation CSS uses", () => {
    const css = readFileSync("src/motion/motion.css", "utf8");
    const used = new Set(css.match(/--lv-m-[a-z]+(?:-[a-z]+)*/g));
    const defined = motionToCss();
    expect(used.size).toBeGreaterThan(5);
    for (const name of used) expect(defined, name).toContain(`${name}:`);
  });
});
