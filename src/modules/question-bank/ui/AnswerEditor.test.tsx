import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../../themes/ThemeProvider.tsx";
import { blankQuestion, type AnswerSpec } from "../domain/model.ts";
import { AnswerEditor } from "./AnswerEditor.tsx";

let latest: AnswerSpec;
function Host({ qtype }: { qtype: "sba" | "multi_select" | "true_false" }) {
  const [answer, setAnswer] = useState<AnswerSpec>(blankQuestion(qtype).answer);
  latest = answer;
  return <AnswerEditor qtype={qtype} answer={answer} onChange={setAnswer} />;
}
const show = (q: "sba" | "multi_select" | "true_false") =>
  render(
    <ThemeProvider>
      <Host qtype={q} />
    </ThemeProvider>,
  );
const count = () => ("options" in latest ? latest.options.length : -1);

afterEach(cleanup);

describe("AnswerEditor option count", () => {
  it("starts with five and allows 2 to 5", () => {
    show("sba");
    expect(count()).toBe(5);
    expect((screen.getByRole("button", { name: "Add option" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("removes down to two and then stops; adding is possible again", () => {
    show("multi_select");
    for (let n = 5; n > 2; n--)
      fireEvent.click(screen.getByRole("button", { name: `Remove option ${n}` }));
    expect(count()).toBe(2);
    expect(
      (screen.getByRole("button", { name: "Remove option 1" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Add option" }));
    expect(count()).toBe(3);
  });

  it("keeps one correct option when the correct one of a single-answer question is removed", () => {
    show("sba");
    fireEvent.click(screen.getByRole("button", { name: "Remove option 1" }));
    expect("options" in latest && latest.options.filter((o) => o.correct)).toHaveLength(1);
    expect(count()).toBe(4);
  });

  it("uses statement wording for true or false", () => {
    show("true_false");
    fireEvent.click(screen.getByRole("button", { name: "Remove statement 5" }));
    expect(count()).toBe(4);
    expect(screen.getByRole("button", { name: "Add statement" })).toBeTruthy();
  });
});
