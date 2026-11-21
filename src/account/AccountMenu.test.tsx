import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../ui-kit/themes/ThemeProvider.tsx";
import AppShell from "../shell/AppShell.tsx";
import { AuthProvider } from "../auth/AuthProvider.tsx";
import { fakeAuth } from "../testing/fakeAuth.ts";
import { MemoryRepo } from "../modules/question-bank/data/memoryRepo.ts";
import { MemoryAttempts } from "../modules/practice/data/memoryAttempts.ts";
import { MemoryWorkspace } from "../modules/workspace/data/memoryWorkspace.ts";
import { MemoryProfile } from "../modules/profile/data/memoryProfile.ts";
import type { ProfileRepo } from "../modules/profile/data/repo.ts";

function shell(
  profile: ProfileRepo = new MemoryProfile(),
  user = { id: "u1", email: "sara@example.test" } as {
    id: string;
    email: string;
    hasPassword?: boolean;
  },
) {
  const client = fakeAuth(user);
  render(
    <ThemeProvider>
      <AuthProvider client={client}>
        <AppShell
          makeRepo={() => new MemoryRepo()}
          makeAttempts={() => new MemoryAttempts()}
          makeWorkspace={() => new MemoryWorkspace()}
          makeProfile={() => profile}
        />
      </AuthProvider>
    </ThemeProvider>,
  );
  return { client, profile };
}

const openMenu = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Account menu" }));
  return screen.getByRole("menu", { name: "Account" });
};

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("account menu", () => {
  it("replaces the old Settings, email and Sign out buttons with one avatar button", async () => {
    shell();
    await screen.findByRole("button", { name: "Account menu" });
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    const menu = await openMenu();
    expect(within(menu).getByText("sara@example.test")).toBeTruthy();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Account", "Appearance", "User guide", "Settings", "Sign out"]);
  });

  it("moves focus into the menu, supports arrow keys and closes on Escape", async () => {
    shell();
    const trigger = await screen.findByRole("button", { name: "Account menu" });
    const menu = await openMenu();
    const items = within(menu).getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(document, { key: "ArrowUp" });
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[4]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("saves a name and avatar, and the avatar then shows initials", async () => {
    const { profile } = shell();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    const dialog = await screen.findByRole("dialog", { name: "Account" });
    expect(
      (within(dialog).getByRole("button", { name: "Save details" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Your name"), {
      target: { value: "  sara   jahan rahman " },
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Rose" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save details" }));
    expect(await within(dialog).findByText("Profile saved.")).toBeTruthy();
    expect(await profile.get()).toEqual({ displayName: "sara jahan rahman", avatar: "rose" });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]!);
    const menu = await openMenu();
    expect(within(menu).getByText("sara jahan rahman")).toBeTruthy();
    expect(screen.getAllByText("SR").length).toBeGreaterThan(0);
  });

  it("shows a save error and keeps the form", async () => {
    const failing: ProfileRepo = {
      get: async () => ({ displayName: "", avatar: "sky" }),
      save: async () => {
        throw new Error("Your session has ended. Sign in again.");
      },
    };
    shell(failing);
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    const dialog = await screen.findByRole("dialog", { name: "Account" });
    fireEvent.change(within(dialog).getByLabelText("Your name"), { target: { value: "Sara" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save details" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("session has ended");
    expect((within(dialog).getByLabelText("Your name") as HTMLInputElement).value).toBe("Sara");
  });

  it("opens Appearance and Settings, and Settings leads to Your data", async () => {
    shell();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Appearance" }));
    const look = await screen.findByRole("dialog", { name: "Appearance" });
    expect(within(look).getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
    fireEvent.click(within(look).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Appearance" })).toBeNull());

    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    const settings = await screen.findByRole("dialog", { name: "Settings" });
    expect(within(settings).getByText("Shortcuts")).toBeTruthy();
  });

  it("changes the password only when the form is valid, and shows the reason when it fails", async () => {
    const { client } = shell();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    const dialog = await screen.findByRole("dialog", { name: "Account" });
    const form = within(dialog).getByRole("form", { name: "Change password" });
    const submit = within(form).getByRole("button", {
      name: "Change password",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const type = (label: string, v: string) =>
      fireEvent.change(within(form).getByLabelText(label), { target: { value: v } });
    type("Current password", "wrong-password");
    type("New password", "short");
    expect(within(form).getByText("Use at least 8 characters.")).toBeTruthy();
    type("New password", "longenough1");
    type("New password again", "different1");
    expect(within(form).getByText("The two new passwords are not the same.")).toBeTruthy();
    expect(submit.disabled).toBe(true);
    type("New password again", "longenough1");
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect((await within(form).findByRole("alert")).textContent).toBe(
      "Your current password is incorrect.",
    );
    type("Current password", "old-password-1");
    fireEvent.click(submit);
    expect(await within(form).findByText("Password changed.")).toBeTruthy();
    expect(client.calls).toContain("changePassword:old-password-1");
    expect((within(form).getByLabelText("New password") as HTMLInputElement).value).toBe("");
  });

  it("changes the email only with the password, and says to confirm from the inbox", async () => {
    const { client } = shell();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    const dialog = await screen.findByRole("dialog", { name: "Account" });
    const form = within(dialog).getByRole("form", { name: "Change email" });
    const send = within(form).getByRole("button", {
      name: "Send confirmation",
    }) as HTMLButtonElement;
    const type = (label: string, v: string) =>
      fireEvent.change(within(form).getByLabelText(label), { target: { value: v } });
    expect(send.disabled).toBe(true);
    type("New email address", "not-an-email");
    expect(within(form).getByText("Enter a valid email address.")).toBeTruthy();
    type("New email address", "SARA@example.test");
    expect(within(form).getByText("That is already your email.")).toBeTruthy();
    type("Your password", "pw");
    expect(send.disabled).toBe(true);
    type("Your password", "");
    type("New email address", "new@example.test");
    expect(send.disabled).toBe(true); // a good address still needs the password
    type("Your password", "pw");
    type("New email address", "taken@example.test");
    fireEvent.click(send);
    expect((await within(form).findByRole("alert")).textContent).toContain("cannot be used");
    type("New email address", "new@example.test");
    type("Your password", "wrong-password");
    fireEvent.click(send);
    expect((await within(form).findByRole("alert")).textContent).toBe(
      "That password is not correct.",
    );
    type("Your password", "right-password");
    fireEvent.click(send);
    expect((await within(form).findByRole("status")).textContent).toContain("new@example.test");
    expect(client.calls).toContain("changeEmail:right-password:new@example.test");
    // The address on screen has not changed: it changes only after the link is opened.
    expect(within(dialog).getByText(/Your sign-in email is sara@example.test/)).toBeTruthy();
  });

  it("Settings has one Account section that opens the Account dialog, with no password form of its own", async () => {
    shell();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    const settings = await screen.findByRole("dialog", { name: "Settings" });
    expect(within(settings).queryByRole("form", { name: "Change password" })).toBeNull();
    fireEvent.click(within(settings).getByRole("button", { name: "Account" }));
    const account = await screen.findByRole("dialog", { name: "Account" });
    expect(within(account).getByRole("form", { name: "Change password" })).toBeTruthy();
    expect(within(account).getByRole("region", { name: "Account details" })).toBeTruthy();
    expect(within(account).getByRole("region", { name: "Delete account" })).toBeTruthy();
  });

  it("deletes the account only after the password and the word DELETE, and signs out", async () => {
    const { client } = shell();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    const account = await screen.findByRole("dialog", { name: "Account" });
    fireEvent.click(within(account).getByRole("button", { name: "Delete account" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete your account?" });
    const go = within(confirm).getByRole("button", {
      name: "Delete my account",
    }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(within(confirm).getByLabelText("Your password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.change(within(confirm).getByLabelText("Type DELETE to confirm"), {
      target: { value: "delete" },
    });
    expect(go.disabled).toBe(true); // must be capital letters
    fireEvent.change(within(confirm).getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(go);
    expect((await within(confirm).findByRole("alert")).textContent).toBe(
      "That password is not correct.",
    );
    fireEvent.change(within(confirm).getByLabelText("Your password"), {
      target: { value: "right-password" },
    });
    fireEvent.click(go);
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
    expect(client.calls).toContain("deleteAccount:right-password");
  });

  it("signs out from the menu", async () => {
    shell();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
  });
});

describe("an account made with Google", () => {
  const google = { id: "g1", email: "student@gmail.com", hasPassword: false };

  it("can add a password without a current one", async () => {
    const { client } = shell(new MemoryProfile(), google);
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    const account = await screen.findByRole("dialog", { name: "Account" });
    const form = within(account).getByRole("form", { name: "Add a password" });
    expect(within(form).queryByLabelText("Current password")).toBeNull();
    fireEvent.change(within(form).getByLabelText("New password"), {
      target: { value: "a-good-password" },
    });
    fireEvent.change(within(form).getByLabelText("New password again"), {
      target: { value: "a-good-password" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Add password" }));
    expect((await within(form).findByRole("status")).textContent).toBe("Password added.");
    expect(client.calls).toContain("setNewPassword:a-good-password");
  });

  it("shows no email form, because Google manages that email", async () => {
    shell(new MemoryProfile(), google);
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    const account = await screen.findByRole("dialog", { name: "Account" });
    expect(within(account).queryByRole("form", { name: "Change email" })).toBeNull();
    expect(within(account).getByText(/managed by Google/)).toBeTruthy();
  });

  it("confirms account deletion with its email address instead of a password", async () => {
    const { client } = shell(new MemoryProfile(), google);
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Account" }));
    const account = await screen.findByRole("dialog", { name: "Account" });
    fireEvent.click(within(account).getByRole("button", { name: "Delete account" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete your account?" });
    expect(within(confirm).queryByLabelText("Your password")).toBeNull();
    fireEvent.change(within(confirm).getByLabelText("Your email address"), {
      target: { value: "someone@else.com" },
    });
    fireEvent.change(within(confirm).getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    const go = within(confirm).getByRole("button", { name: "Delete my account" });
    fireEvent.click(go);
    expect((await within(confirm).findByRole("alert")).textContent).toBe(
      "That is not the email on this account.",
    );
    fireEvent.change(within(confirm).getByLabelText("Your email address"), {
      target: { value: "student@gmail.com" },
    });
    fireEvent.click(go);
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
    expect(client.calls).toContain("deleteAccount:student@gmail.com");
  });
});
