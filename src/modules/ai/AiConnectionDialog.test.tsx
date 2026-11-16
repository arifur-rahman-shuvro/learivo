import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../themes/ThemeProvider.tsx";
import { AiConnectionDialog } from "./AiConnectionDialog.tsx";
import { activeConfig, closeAiConnection, openAiConnection, reloadAi } from "./keys.ts";

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
