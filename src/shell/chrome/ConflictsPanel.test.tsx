import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { blankQuestion } from "../../modules/question-bank/domain/model.ts";
import type { Conflict } from "../../platform/offline/merge.ts";
import type { PackStatus } from "../../platform/offline/pack.ts";
import ConflictsPanel from "./ConflictsPanel.tsx";

afterEach(cleanup);

const q = (stem: string, explanation = "") => ({ ...blankQuestion("sba"), stem, explanation });

const status = (over: Partial<PackStatus>): PackStatus => ({
  enabled: true,
  savedAt: null,
  count: 0,
  waiting: 0,
  failed: [],
  conflicts: [],
  resolved: [],
  ...over,
});

const edited: Conflict = {
  id: "q1",
  kind: "edited",
  base: q("Original", "Base note"),
  mine: q("Mine stem", "Mine note"),
  theirs: q("Cloud stem", "Cloud note"),
  clashes: ["stem", "explanation"],
  at: "2026-11-20T00:00:00Z",
};

describe("ConflictsPanel", () => {
  it("asks for a choice on every clashing part before applying", () => {
    const onResolve = vi.fn();
    render(
      <ConflictsPanel
        status={status({ conflicts: [edited] })}
        busy={false}
        onResolve={onResolve}
        onReapply={() => undefined}
      />,
    );
    const apply = screen.getByRole("button", { name: "Apply my choices" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    fireEvent.click(radios[0]!); // question: mine
    expect(apply.disabled).toBe(true);
    fireEvent.click(radios[3]!); // explanation: account's
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    expect(onResolve).toHaveBeenCalledWith("q1", { stem: "mine", explanation: "theirs" });
  });

  it("offers whole-question choices", () => {
    const onResolve = vi.fn();
    render(
      <ConflictsPanel
        status={status({ conflicts: [edited] })}
        busy={false}
        onResolve={onResolve}
        onReapply={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep all of mine" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep the account's version" }));
    expect(onResolve.mock.calls).toEqual([
      ["q1", "mine"],
      ["q1", "theirs"],
    ]);
  });

  it("explains a question deleted elsewhere", () => {
    const onResolve = vi.fn();
    const gone: Conflict = { ...edited, kind: "deleted", theirs: null, clashes: [] };
    render(
      <ConflictsPanel
        status={status({ conflicts: [gone] })}
        busy={false}
        onResolve={onResolve}
        onReapply={() => undefined}
      />,
    );
    expect(screen.getByText(/deleted somewhere else/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add my version back" }));
    expect(onResolve).toHaveBeenCalledWith("q1", "mine");
  });

  it("lists earlier decisions and can bring a version back", () => {
    const onReapply = vi.fn();
    render(
      <ConflictsPanel
        status={status({
          resolved: [{ conflict: edited, outcome: "theirs", at: "2026-11-20T01:00:00Z" }],
        })}
        busy={false}
        onResolve={() => undefined}
        onReapply={onReapply}
      />,
    );
    expect(screen.queryByText("Needs your decision")).toBeNull();
    expect(screen.getByText("Kept the account's version", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bring back my version" }));
    expect(onReapply).toHaveBeenCalledWith(0, "mine");
  });
});
