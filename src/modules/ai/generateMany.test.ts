import { describe, expect, it, vi } from "vitest";
import { generateMany, type Progress } from "./generate.ts";
import { DEFAULT_SPEC } from "../question-bank/domain/promptBuilder.ts";
import type { AiConfig } from "./providers.ts";

const cfg: AiConfig = { provider: "openai", key: "k", model: "m" };

const q = (n: number) => ({
  stem: `Question number ${n}`,
  type: "single_choice",
  options: [
    { text: "A", correct: true },
    { text: "B", correct: false },
  ],
});
const batch = (from: number, n: number) =>
  JSON.stringify({ questions: Array.from({ length: n }, (_, i) => q(from + i)) });
const reply = (text: string) =>
  Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: text } }] })));

describe("generateMany", () => {
  it("asks for one batch at a time, tells the AI what is already written, and joins the answers", async () => {
    const prompts: string[] = [];
    const f = vi.fn((_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { messages: { content: string }[] };
      prompts.push(body.messages[0]!.content);
      return reply(prompts.length === 1 ? batch(0, 25) : batch(25, 5));
    }) as unknown as typeof fetch;
    const seen: Progress[] = [];
    const out = await generateMany(
      cfg,
      { ...DEFAULT_SPEC, subject: "Anatomy", count: 30 },
      { fetchImpl: f, retryWaits: [], onProgress: (p) => seen.push(p) },
    );
    expect(out.wanted).toBe(30);
    expect(JSON.parse(out.text)).toHaveLength(30);
    expect(seen.map((p) => [p.batch, p.batches, p.have])).toEqual([
      [1, 2, 0],
      [2, 2, 25],
    ]);
    expect(prompts[0]).not.toContain("Do not repeat");
    expect(prompts[1]).toContain("Do not repeat");
    expect(prompts[1]).toContain("Question number 24");
    expect(out.stoppedBecause).toBeNull();
  });

  it("keeps the questions it has when a later batch fails", async () => {
    let n = 0;
    const f = vi.fn(() =>
      ++n === 1
        ? reply(batch(0, 25))
        : Promise.resolve(
            new Response(JSON.stringify({ error: { message: "no credit" } }), { status: 402 }),
          ),
    ) as unknown as typeof fetch;
    const out = await generateMany(
      cfg,
      { ...DEFAULT_SPEC, subject: "Anatomy", count: 50 },
      { fetchImpl: f, retryWaits: [] },
    );
    expect(JSON.parse(out.text)).toHaveLength(25);
    expect(out.stoppedBecause).toBeTruthy();
  });

  it("fails when the very first batch fails", async () => {
    const f = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ error: { message: "bad" } }), { status: 401 })),
    ) as unknown as typeof fetch;
    await expect(
      generateMany(
        cfg,
        { ...DEFAULT_SPEC, subject: "A", count: 10 },
        { fetchImpl: f, retryWaits: [] },
      ),
    ).rejects.toThrow();
  });
});
