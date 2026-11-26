import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { ThemeProvider } from "../ui-kit/themes/ThemeProvider.tsx";
import AppShell from "./AppShell.tsx";
import { AuthProvider } from "../auth/AuthProvider.tsx";
import { fakeAuth } from "../testing/fakeAuth.ts";
import { MemoryRepo } from "../modules/question-bank/data/memoryRepo.ts";
import { MemoryAttempts } from "../modules/practice/data/memoryAttempts.ts";
import { MemoryWorkspace } from "../modules/workspace/data/memoryWorkspace.ts";
import { blankQuestion } from "../modules/question-bank/domain/model.ts";
import { SAMPLE_QUESTIONS } from "../modules/question-bank/domain/sample.ts";

/**
 * Every main screen, with sample data, must pass the automatic accessibility checks (names,
 * roles, labels, landmarks). Colour contrast needs a real browser, so it is not checked here.
 */
async function violations(): Promise<string[]> {
  const result = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
}

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("accessibility of the main screens", () => {
  for (const [name, hash, ready] of [
    ["Home", "#/home", /Today|Your question bank starts here/],
    ["Questions", "#/questions", /Questions/],
    ["Practice", "#/practice", /Quick start/],
    ["Review", "#/review", /Review/],
    ["Progress", "#/insights", /Progress/],
  ] as const) {
    it(`${name} has no automatic accessibility problems`, async () => {
      const bank = new MemoryRepo();
      await bank.create([
        ...SAMPLE_QUESTIONS,
        { ...blankQuestion("sba"), stem: "An extra question", answer: SAMPLE_QUESTIONS[0]!.answer },
      ]);
      window.location.hash = hash;
      render(
        <ThemeProvider>
          <AuthProvider client={fakeAuth({ id: "u1", email: "sara@example.test" })}>
            <AppShell
              makeRepo={() => bank}
              makeAttempts={() => new MemoryAttempts()}
              makeWorkspace={() => new MemoryWorkspace()}
            />
          </AuthProvider>
        </ThemeProvider>,
      );
      await screen.findAllByText(ready, undefined, { timeout: 3000 });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 300));
      });
      await waitFor(async () => expect(await violations()).toEqual([]));
    });
  }
});
