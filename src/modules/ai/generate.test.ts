import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC } from "../question-bank/domain/promptBuilder.ts";
import { generateQuestions } from "./generate.ts";
import type { AiConfig } from "./providers.ts";

const cfg: AiConfig = { provider: "openai", key: "k", model: "m" };
const good = JSON.stringify([
  {
    type: "sba",
    stem: "Which is right?",
    options: [
      { text: "A", correct: true },
      { text: "B", correct: false },
    ],
  },
]);

/** A fetch that answers with each text in turn. */
function replies(...texts: string[]) {
  let i = 0;
  const f = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ choices: [{ message: { content: texts[i++] ?? "" } }] })),
    ),
  );
  return f as unknown as typeof fetch & { mock: { calls: [string, RequestInit][] } };
}

describe("generateQuestions", () => {
  it("returns a readable reply straight away", async () => {
    const f = replies("```json\n" + good + "\n```");
    const out = await generateQuestions(cfg, DEFAULT_SPEC, { fetchImpl: f });
    expect(out.retried).toBe(false);
    expect(f.mock.calls).toHaveLength(1);
  });

  it("asks once more when the first reply cannot be read", async () => {
    const f = replies("Sorry, here are some questions in prose.", good);
    const out = await generateQuestions(cfg, DEFAULT_SPEC, { fetchImpl: f });
    expect(out.retried).toBe(true);
    expect(out.text).toBe(good);
    expect(f.mock.calls).toHaveLength(2);
    expect(String(f.mock.calls[1]![1].body)).toContain("could not be used");
  });

  it("gives up after one retry instead of looping", async () => {
    const f = replies("nope", "still nope", good);
    const out = await generateQuestions(cfg, DEFAULT_SPEC, { fetchImpl: f });
    expect(f.mock.calls).toHaveLength(2);
    expect(out.text).toBe("still nope");
  });

  it("never asks for more than one batch", async () => {
    const f = replies(good);
    const out = await generateQuestions(cfg, { ...DEFAULT_SPEC, count: 200 }, { fetchImpl: f });
    expect(out.asked).toBe(25);
    expect(String(f.mock.calls[0]![1].body)).toContain("25");
  });

  it("sends the student's notes to the AI", async () => {
    const f = replies(good);
    await generateQuestions(
      cfg,
      { ...DEFAULT_SPEC, material: "Mitochondria make ATP." },
      { fetchImpl: f },
    );
    expect(String(f.mock.calls[0]![1].body)).toContain("Mitochondria make ATP.");
  });
});
