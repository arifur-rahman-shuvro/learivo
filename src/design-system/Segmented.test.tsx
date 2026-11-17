import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Segmented } from "./Segmented.tsx";

afterEach(cleanup);

function Host() {
  const [v, setV] = useState("short");
  return (
    <Segmented
      label="Explanations"
      value={v}
      onChange={setV}
      options={[
        { value: "none", label: "None" },
        { value: "short", label: "Short" },
        { value: "detailed", label: "Detailed" },
      ]}
    />
  );
}

describe("Segmented", () => {
  it("marks the current choice and changes it by tap or arrow key", () => {
    render(<Host />);
    expect(screen.getByRole("radiogroup", { name: "Explanations" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Short" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "None" }));
    expect(screen.getByRole("radio", { name: "None" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(screen.getByRole("radio", { name: "None" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Short" }).getAttribute("aria-checked")).toBe("true");
  });
});
