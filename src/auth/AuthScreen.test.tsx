import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../ui-kit/themes/ThemeProvider.tsx";
import AppShell from "../shell/AppShell.tsx";
import { AuthProvider } from "./AuthProvider.tsx";
import { fakeAuth } from "../testing/fakeAuth.ts";
import type { AuthClient } from "./types.ts";
import { MemoryProfile } from "../modules/profile/data/memoryProfile.ts";

const renderApp = (client: AuthClient, at: string = "#/sign-in") => {
  window.location.hash = at;
  return render(
    <ThemeProvider>
      <AuthProvider client={client}>
        <AppShell makeProfile={() => new MemoryProfile()} />
      </AuthProvider>
    </ThemeProvider>,
  );
};

afterEach(() => {
  cleanup();
  window.location.hash = "";
  window.localStorage.clear();
});

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("auth gate and sign-in", () => {
  it("shows the sign-in screen when signed out", async () => {
    renderApp(fakeAuth(null));
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
  });

  it("links to the privacy and terms pages from the sign-in screen", async () => {
    renderApp(fakeAuth(null));
    const legal = await screen.findByRole("navigation", { name: "Legal" });
    expect(within(legal).getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe(
      "/privacy.html",
    );
    expect(within(legal).getByRole("link", { name: "Terms" }).getAttribute("href")).toBe(
      "/terms.html",
    );
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
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
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

  it("says so when the session ends by itself, but not when the student signs out", async () => {
    const client = fakeAuth({ id: "u1", email: "a@b.co" });
    renderApp(client);
    await screen.findByRole("button", { name: "Account menu" });
    act(() => client.expire());
    expect((await screen.findByRole("status")).textContent).toContain("Your session ended");
    cleanup();

    const own = fakeAuth({ id: "u1", email: "a@b.co" });
    renderApp(own);
    await screen.findByRole("button", { name: "Account menu" });
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    await screen.findByRole("heading", { name: "Sign in to Learivo" });
    expect(screen.queryByText(/Your session ended/)).toBeNull();
  });
});

describe("forgot password", () => {
  it("asks for the email only, sends the link, and says the same thing for any address", async () => {
    const client = fakeAuth(null);
    renderApp(client);
    fireEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeTruthy();
    expect(screen.queryByLabelText("Password")).toBeNull();
    const send = screen.getByRole("button", { name: "Send reset link" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    type("Email", "student@example.com");
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    expect((await screen.findByRole("status")).textContent).toMatch(
      /If student@example\.com has an account/,
    );
    expect(client.calls).toContain("requestPasswordReset:student@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
  });

  it("shows a refusal, such as too many requests, and stays on the form", async () => {
    const client = fakeAuth(null);
    client.requestPasswordReset = async () => ({
      ok: false,
      message: "Too many requests. Wait a few minutes and try again.",
    });
    renderApp(client);
    fireEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    type("Email", "student@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Too many requests/);
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeTruthy();
  });

  it("opening the emailed link asks for a new password before showing the app", async () => {
    const client = fakeAuth(null);
    renderApp(client);
    await screen.findByRole("heading", { name: "Sign in to Learivo" });
    act(() => client.openResetLink("student@example.com"));
    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
    const save = screen.getByRole("button", { name: "Save new password" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    type("New password", "short");
    expect(screen.getByText("Use at least 8 characters.", { selector: "p, span" })).toBeTruthy();
    type("New password", "a-good-password");
    type("Repeat new password", "different-one");
    expect(screen.getByText("The passwords do not match.")).toBeTruthy();
    expect(save.disabled).toBe(true);
    type("Repeat new password", "a-good-password");
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(await screen.findByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(client.calls).toContain("setNewPassword:a-good-password");
  });

  it("keeps the new-password screen when the password is refused", async () => {
    const client = fakeAuth(null);
    renderApp(client);
    await screen.findByRole("heading", { name: "Sign in to Learivo" });
    act(() => client.openResetLink("student@example.com"));
    await screen.findByRole("heading", { name: "Choose a new password" });
    type("New password", "same-as-before");
    type("Repeat new password", "same-as-before");
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/not used on this account/);
    expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeTruthy();
  });

  it("cancelling the reset signs out and returns to sign in", async () => {
    const client = fakeAuth(null);
    renderApp(client);
    await screen.findByRole("heading", { name: "Sign in to Learivo" });
    act(() => client.openResetLink("student@example.com"));
    await screen.findByRole("heading", { name: "Choose a new password" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
    expect(client.calls).toContain("signOut");
    // No "session ended" notice: the student chose this.
    expect(screen.queryByText(/session ended/i)).toBeNull();
  });

  it("starts on the new-password screen when the page was opened from the link", async () => {
    const client = fakeAuth({ id: "u1", email: "student@example.com" });
    client.startedInRecovery = true;
    renderApp(client);
    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeTruthy();
  });

  it("tells the student when the link has expired", async () => {
    const client = fakeAuth(null);
    client.startupNotice =
      "That link has expired or was already used. Choose Forgot password and ask for a new one.";
    renderApp(client);
    expect(await screen.findByText(/link has expired/)).toBeTruthy();
  });
});

describe("Google sign-in", () => {
  it("shows no Google button until the project has Google switched on", async () => {
    renderApp(fakeAuth(null));
    await screen.findByRole("heading", { name: "Sign in to Learivo" });
    await act(async () => {});
    expect(screen.queryByRole("button", { name: /Continue with Google/ })).toBeNull();
  });

  it("signs in with Google when it is switched on, on both the sign-in and create-account screens", async () => {
    const client = fakeAuth(null);
    client.enableGoogle();
    renderApp(client);
    fireEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    expect(await screen.findByRole("button", { name: /Continue with Google/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Continue with Google/ }));
    expect(await screen.findByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(client.calls).toContain("signInWithGoogle");
  });

  it("does not offer Google on the reset-password screen", async () => {
    const client = fakeAuth(null);
    client.enableGoogle();
    renderApp(client);
    await screen.findByRole("button", { name: /Continue with Google/ });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    await screen.findByRole("heading", { name: "Reset your password" });
    expect(screen.queryByRole("button", { name: /Continue with Google/ })).toBeNull();
  });

  it("shows the refusal when Google sign-in cannot start", async () => {
    const client = fakeAuth(null);
    client.enableGoogle();
    client.signInWithGoogle = async () => ({
      ok: false,
      message: "Something went wrong. Check your connection and try again.",
    });
    renderApp(client);
    fireEvent.click(await screen.findByRole("button", { name: /Continue with Google/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Something went wrong/);
  });
});

describe("the page that introduces Learivo", () => {
  it("is what a new visitor sees, with a question they can answer without an account", async () => {
    renderApp(fakeAuth(null), "");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Practise the way the exam asks." }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Left anterior descending/ }));
    expect(screen.getByRole("group", { name: "How sure are you?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sure" }));
    expect(
      await screen.findByText(/Not quite: the answer is the right coronary artery/),
    ).toBeTruthy();
    expect(screen.getByText(/Sure, but wrong\./)).toBeTruthy();
    // The right answer is marked, and the choice is locked.
    expect(
      screen.getByRole("radio", { name: /Right coronary artery/ }).getAttribute("data-state"),
    ).toBe("right");
    expect(screen.getByRole("radio", { name: /Left main stem/ }).hasAttribute("disabled")).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByText(/Not quite/)).toBeNull();
    expect(screen.getByRole("radio", { name: /Left main stem/ }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("says what happens to a right answer you were unsure about", async () => {
    renderApp(fakeAuth(null), "");
    fireEvent.click(await screen.findByRole("radio", { name: /Right coronary artery/ }));
    fireEvent.click(screen.getByRole("button", { name: "Not sure" }));
    expect(await screen.findByText(/Correct: right coronary artery/)).toBeTruthy();
    expect(screen.getByText(/Right, but unsure\./)).toBeTruthy();
  });

  it("opens Create your account or Sign in from its buttons, and comes back with About Learivo", async () => {
    renderApp(fakeAuth(null), "");
    fireEvent.click((await screen.findAllByRole("button", { name: "Create your account" }))[0]!);
    expect(await screen.findByRole("heading", { name: "Create your account" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "About Learivo" }));
    await screen.findByRole("heading", { level: 1, name: "Practise the way the exam asks." });
    fireEvent.click(screen.getAllByRole("button", { name: "Sign in" })[0]!);
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
  });

  it("skips the introduction for someone who has signed in on this device", async () => {
    window.localStorage.setItem("learivo.returning", "1");
    renderApp(fakeAuth(null), "");
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
  });

  it("remembers the device after signing in, and leaves the sign-in address", async () => {
    renderApp(fakeAuth(null));
    await screen.findByRole("heading", { name: "Sign in to Learivo" });
    type("Email", "me@example.test");
    type("Password", "secret-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("navigation", { name: "Primary" });
    expect(window.localStorage.getItem("learivo.returning")).toBe("1");
    expect(window.location.hash).not.toBe("#/sign-in");
  });

  it("works out the daily pace and explains the four kinds of answer", async () => {
    renderApp(fakeAuth(null), "");
    await screen.findByRole("heading", { level: 1 });
    // 1,500 questions over 60 days is 25 a day.
    expect(screen.getByText("25")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Days until your exam/), { target: { value: "30" } });
    expect(screen.getByText("50")).toBeTruthy();
    // Never round down: 1,000 questions in 60 days needs 17 a day, not 16.
    fireEvent.change(screen.getByLabelText(/Days until your exam/), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText(/Questions you still want to cover/), {
      target: { value: "1000" },
    });
    expect(screen.getByText("17")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Right but unsure/ }));
    expect(screen.getByText(/Right by instinct or luck/)).toBeTruthy();
  });
});
