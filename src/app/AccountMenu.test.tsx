import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../themes/ThemeProvider.tsx";
import AppShell from "./AppShell.tsx";
import { AuthProvider } from "../auth/AuthProvider.tsx";
import { fakeAuth } from "../core/testing/fakeAuth.ts";
import { MemoryRepo } from "../modules/question-bank/data/memoryRepo.ts";
import { MemoryAttempts } from "../modules/practice/data/memoryAttempts.ts";
import { MemoryWorkspace } from "../modules/workspace/data/memoryWorkspace.ts";
import { MemoryProfile } from "../modules/profile/data/memoryProfile.ts";
import type { ProfileRepo } from "../modules/profile/data/repo.ts";

function shell(profile: ProfileRepo = new MemoryProfile()) {
  const client = fakeAuth({ id: "u1", email: "sara@example.test" });
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
    ).toEqual(["Your profile", "Appearance", "User guide", "Settings", "Sign out"]);
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
    fireEvent.click(screen.getByRole("menuitem", { name: "Your profile" }));
    const dialog = await screen.findByRole("dialog", { name: "Your profile" });
    expect(
      (within(dialog).getByRole("button", { name: "Save profile" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Your name"), {
      target: { value: "  sara   jahan rahman " },
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Rose" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save profile" }));
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
    fireEvent.click(screen.getByRole("menuitem", { name: "Your profile" }));
    const dialog = await screen.findByRole("dialog", { name: "Your profile" });
    fireEvent.change(within(dialog).getByLabelText("Your name"), { target: { value: "Sara" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save profile" }));
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
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog", { name: "Settings" });
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

  it("signs out from the menu", async () => {
    shell();
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in to Learivo" })).toBeTruthy();
  });
});
