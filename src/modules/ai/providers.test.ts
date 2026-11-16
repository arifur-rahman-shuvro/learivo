import { describe, expect, it, vi } from "vitest";
import { AiError, askAi, type AiConfig } from "./providers.ts";

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

function fake(body: unknown, status = 200) {
  return vi.fn(() => reply(body, status)) as unknown as typeof fetch & {
    mock: { calls: [string, RequestInit][] };
  };
}

const cfg = (provider: AiConfig["provider"], model = "m1"): AiConfig => ({
  provider,
  key: "SECRET-KEY-123",
  model,
});

describe("askAi", () => {
  it("talks to Gemini with the key in a header, not in the address", async () => {
    const f = fake({
      candidates: [{ content: { parts: [{ text: "Hello " }, { text: "there" }] } }],
    });
    expect(await askAi(cfg("gemini", "gemini-x"), "Hi", { fetchImpl: f })).toBe("Hello there");
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent",
    );
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("SECRET-KEY-123");
    expect(url).not.toContain("SECRET");
    expect(String(init.body)).toContain('"text":"Hi"');
  });

  it("talks to OpenAI and OpenRouter in the chat completions format", async () => {
    for (const [id, host] of [
      ["openai", "https://api.openai.com/v1/chat/completions"],
      ["openrouter", "https://openrouter.ai/api/v1/chat/completions"],
    ] as const) {
      const f = fake({ choices: [{ message: { content: "Answer" } }] });
      expect(await askAi(cfg(id), "Hi", { fetchImpl: f })).toBe("Answer");
      const [url, init] = f.mock.calls[0]!;
      expect(url).toBe(host);
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer SECRET-KEY-123");
      expect(JSON.parse(String(init.body)).model).toBe("m1");
    }
  });

  it("talks to Anthropic with the browser-access header", async () => {
    const f = fake({ content: [{ type: "text", text: "Claude says hi" }] });
    expect(await askAi(cfg("anthropic"), "Hi", { fetchImpl: f })).toBe("Claude says hi");
    const [url, init] = f.mock.calls[0]!;
    const h = init.headers as Record<string, string>;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(h["x-api-key"]).toBe("SECRET-KEY-123");
    expect(h["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(h["anthropic-version"]).toBeTruthy();
    expect(JSON.parse(String(init.body)).max_tokens).toBeGreaterThan(0);
  });

  it.each([
    [401, "key"],
    [403, "key"],
    [402, "credit"],
    [404, "model"],
    [429, "limit"],
    [503, "other"],
  ] as const)("explains HTTP %i as a %s problem", async (status, kind) => {
    const f = fake({ error: { message: "nope" } }, status);
    const err = await askAi(cfg("openai"), "Hi", { fetchImpl: f }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe(kind);
  });

  it("treats Gemini's 400 for a bad key as a key problem", async () => {
    const f = fake({ error: { message: "API key not valid. Please pass a valid API key." } }, 400);
    const err = (await askAi(cfg("gemini"), "Hi", { fetchImpl: f }).catch(
      (e: unknown) => e,
    )) as AiError;
    expect(err.kind).toBe("key");
  });

  it("never repeats the key in an error message", async () => {
    const f = fake({ error: { message: "Bad key SECRET-KEY-123 given" } }, 401);
    const err = (await askAi(cfg("openai"), "Hi", { fetchImpl: f }).catch(
      (e: unknown) => e,
    )) as AiError;
    expect(err.message).not.toContain("SECRET-KEY-123");
    expect(err.message).toContain("***");
  });

  it("reports a network failure and an empty answer", async () => {
    const down = vi.fn(() =>
      Promise.reject(new TypeError("Failed to fetch")),
    ) as unknown as typeof fetch;
    const e1 = (await askAi(cfg("openai"), "Hi", { fetchImpl: down }).catch(
      (e: unknown) => e,
    )) as AiError;
    expect(e1.kind).toBe("network");
    const empty = fake({ choices: [{ message: { content: "  " } }] });
    const e2 = (await askAi(cfg("openai"), "Hi", { fetchImpl: empty }).catch(
      (e: unknown) => e,
    )) as AiError;
    expect(e2.message).toContain("empty answer");
  });

  it("says when Gemini refuses the request", async () => {
    const f = fake({ promptFeedback: { blockReason: "SAFETY" } });
    const err = (await askAi(cfg("gemini"), "Hi", { fetchImpl: f }).catch(
      (e: unknown) => e,
    )) as AiError;
    expect(err.kind).toBe("blocked");
  });
});
