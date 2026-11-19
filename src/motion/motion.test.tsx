import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Dialog } from "../ui-kit/overlays/Dialog.tsx";
import { originPose, recentOrigin, trackOrigins } from "./origin.ts";

beforeEach(() => {
  // jsdom has no layout, so give every element a size.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 36, 36));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("origin motion", () => {
  it("remembers the control that was just tapped", () => {
    trackOrigins();
    const { getByText } = render(<button>Open it</button>);
    fireEvent.click(getByText("Open it"));
    expect(recentOrigin()).not.toBeNull();
  });

  it("resolves data-origin-from to the named control", () => {
    trackOrigins();
    const { getByText } = render(
      <div>
        <button id="avatar-x">Me</button>
        <div data-origin-from="avatar-x">
          <button>Item</button>
        </div>
      </div>,
    );
    fireEvent.click(getByText("Item"));
    expect(recentOrigin()?.el?.id).toBe("avatar-x");
  });

  it("starts a panel small and moved toward the origin", () => {
    const panel = document.createElement("div");
    const pose = originPose(panel, { x: 100, y: 20, w: 36, h: 36, el: null });
    expect(pose.transform).toContain("scale(");
    expect(pose.transform).toContain("translate(");
  });

  it("closes at once when motion cannot play", () => {
    const view = render(
      <Dialog open title="Hello" onClose={() => undefined}>
        body
      </Dialog>,
    );
    expect(view.getByRole("dialog")).toBeTruthy();
    view.rerender(
      <Dialog open={false} title="Hello" onClose={() => undefined}>
        body
      </Dialog>,
    );
    expect(view.queryByRole("dialog")).toBeNull();
  });
});
