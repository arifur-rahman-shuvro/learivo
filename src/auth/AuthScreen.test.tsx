import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "../themes/ThemeProvider.tsx";
import AppShell from "../app/AppShell.tsx";
import { AuthProvider } from "./AuthProvider.tsx";
import { fakeAuth } from "../test/fakeAuth.ts";
import type { AuthClient } from "./types.ts";

const renderApp = (client: AuthClient) =>
  render(
    <ThemeProvider>
      <AuthProvider client={client}>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>,
  );

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("auth gate and sign-in", () => {
  it("shows the sign-in screen when signed out", async () => {
    renderApp(fakeAuth(null));
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
  });

  it("keeps the submit button disabled until the email looks valid", async () => {
    renderApp(fakeAuth(null));
    await screen.findByRole("heading", { name: "Sign in to Learivo" });
    const button = screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    type("Email", "not-an-email");
    type("Password", "secret");
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    type("Email", "sara@example.test");
    expect(button.disabled).toBe(false);
  });

  it("signs in and then shows the app with the user's email", async () => {
    const client = fakeAuth(null);
    renderApp(client);
    await screen.findByRole("heading", { name: "Sign in to Learivo" });
    type("Email", "sara@example.test");
    type("Password", "secret123");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(screen.getByText("sara@example.test")).toBeTruthy();
    expect(client.calls).toContain("signIn:sara@example.test");
  });

  it("shows a plain error when sign-in fails", async () => {
    renderApp(
      fakeAuth(null, {
        signIn: async () => ({ ok: false, message: "Email or password is incorrect." }),
      }),
    );
    await screen.findByRole("heading", { name: "Sign in to Learivo" });
    type("Email", "sara@example.test");
    type("Password", "wrongpass");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Email or password is incorrect.");
  });

  it("signs out back to the sign-in screen", async () => {
    renderApp(fakeAuth({ id: "u1", email: "sara@example.test" }));
    await screen.findByRole("navigation", { name: "Primary" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
  });
});

describe("sign-up", () => {
  async function toSignUp(client: AuthClient) {
    renderApp(client);
    await screen.findByRole("heading", { name: "Sign in to Learivo" });
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    await screen.findByRole("heading", { name: "Create your account" });
  }

  it("requires at least 8 characters", async () => {
    await toSignUp(fakeAuth(null));
    type("Email", "sara@example.test");
    type("Password", "short");
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("tells the student to confirm their email", async () => {
    const client = fakeAuth(null);
    await toSignUp(client);
    type("Email", "sara@example.test");
    type("Password", "longenough1");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Check your email" })).toBeTruthy(),
    );
    expect(client.calls).toContain("signUp:sara@example.test");
  });
});
