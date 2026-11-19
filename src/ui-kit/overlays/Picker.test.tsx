import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Picker, type PickerOption } from "./Picker.tsx";

afterEach(cleanup);

const OPTIONS: PickerOption[] = [
  { value: "a", label: "Anatomy" },
  { value: "a1", label: "Heart", depth: 1 },
  { value: "p", label: "Physiology" },
  { value: "b", label: "Biochemistry" },
  { value: "m", label: "Microbiology" },
  { value: "x", label: "Pharmacology" },
  { value: "y", label: "Pathology" },
];

function Host() {
  const [v, setV] = useState("");
  return (
    <Picker label="Subject" emptyLabel="All subjects" value={v} options={OPTIONS} onChange={setV} />
  );
}

describe("Picker", () => {
  it("shows the current choice, opens a sheet, and changes the choice with one tap", () => {
    render(<Host />);
    const trigger = screen.getByRole("button", { name: "Subject: All subjects" });
    fireEvent.click(trigger);
    expect(screen.getByRole("option", { name: /All subjects/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("option", { name: "Heart" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Subject: Heart" })).toBeTruthy();
  });

  it("searches long lists and says when nothing matches", () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: /^Subject:/ }));
    fireEvent.change(screen.getByLabelText("Search subject"), { target: { value: "path" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Pathology"]);
    fireEvent.change(screen.getByLabelText("Search subject"), { target: { value: "zzz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });
});
