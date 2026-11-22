import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../ui-kit/themes/ThemeProvider.tsx";
import { ADVICE, AiConnectionDialog } from "./AiConnectionDialog.tsx";
import { reloadUsage } from "./usage.ts";
import { activeConfig, reloadAi } from "./keys.ts";
import { closeAiConnection, openAiConnection } from "../../core/dialogs/ai.ts";

function show() {
  render(
    <ThemeProvider>
      <AiConnectionDialog />
    </ThemeProvider>,
  );
  act(() => openAiConnection());
}

beforeEach(() => {
  localStorage.clear();
  reloadAi();
});
afterEach(() => {
  act(() => closeAiConnection());
  cleanup();
  vi.unstubAllGlobals();
});

describe("AI connection dialog", () => {
  it("saves the key on this device after a successful test", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK" }] } }] })),
        ),
      ),
    );
    show();
    fireEvent.change(await screen.findByLabelText("API key"), { target: { value: "my-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Test and save" }));
    expect((await screen.findByRole("status")).textContent).toContain("Connected");
    expect(activeConfig()?.key).toBe("my-key");
    expect(activeConfig()?.provider).toBe("gemini");
  });

  it("shows why a key failed and does not save it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { message: "bad" } }), { status: 401 }),
        ),
      ),
    );
    show();
    fireEvent.change(await screen.findByLabelText("API key"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Test and save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("did not accept this key");
    expect(activeConfig()).toBeNull();
  });

  it("keeps the key hidden until asked, and can remove it", async () => {
    localStorage.setItem(
      "learivo.ai",
      JSON.stringify({ provider: "openai", keys: { openai: "sk-test" }, models: {} }),
    );
    reloadAi();
    show();
    const key = (await screen.findByLabelText("API key")) as HTMLInputElement;
    expect(key.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(key.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Remove key from this device" }));
    await waitFor(() => expect(activeConfig()).toBeNull());
  });

  it("offers the official key page and a guide prompt without the key in it", async () => {
    const copied: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (t: string) => (copied.push(t), Promise.resolve()) },
    });
    show();
    const link = (await screen.findByRole("link", {
      name: /aistudio.google.com\/apikey/,
    })) as HTMLAnchorElement;
    expect(link.rel).toContain("noopener");
    fireEvent.click(screen.getByRole("button", { name: "Copy guide prompt" }));
    await screen.findByRole("button", { name: "Copied" });
    expect(copied[0]).toContain("Never ask me to paste my key into this chat");
    expect(copied[0]).toContain("https://aistudio.google.com/apikey");
  });
});

describe("AI connection help", () => {
  it("tells the student what to do for each kind of failure, and counts requests", async () => {
    localStorage.clear();
    reloadUsage();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ error: { message: "x" } }), { status: 402 })),
      ),
    );
    show();
    fireEvent.change(await screen.findByLabelText("API key"), { target: { value: "k" } });
    fireEvent.click(screen.getByRole("button", { name: "Test and save" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("no credit left");
    expect(alert.textContent).toContain(ADVICE.credit);
    expect(screen.getByText(/1 request today, 1 in all/)).toBeTruthy();
  });

  it("shows tokens a provider reports and resets the counter", async () => {
    localStorage.clear();
    reloadUsage();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "OK" }] } }],
              usageMetadata: { totalTokenCount: 1234 },
            }),
          ),
        ),
      ),
    );
    show();
    fireEvent.change(await screen.findByLabelText("API key"), { target: { value: "k" } });
    fireEvent.click(screen.getByRole("button", { name: "Test and save" }));
    await screen.findByRole("status");
    expect(screen.getByText(/About 1,234 tokens/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset counter" }));
    expect(screen.getByText(/0 requests today, 0 in all/)).toBeTruthy();
  });
});
