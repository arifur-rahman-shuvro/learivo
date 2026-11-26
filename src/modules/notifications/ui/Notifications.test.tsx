import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "../../../ui-kit/themes/ThemeProvider.tsx";
import { DEFAULT_SETTINGS, type PushSettings } from "../domain/settings.ts";
import type { PushSettingsRepo } from "../data/settingsRepo.ts";
import { NotificationsPanel, type DeviceApi } from "./NotificationsPanel.tsx";
import { PushInvite } from "./PushInvite.tsx";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function fakeRepo(initial: PushSettings = DEFAULT_SETTINGS, starts: string[] = []) {
  const saved: PushSettings[] = [];
  const repo: PushSettingsRepo = {
    load: async () => initial,
    save: async (s) => void saved.push(s),
    recentStarts: async () => starts,
  };
  return { repo, saved };
}
function fakeDevice(over: Partial<DeviceApi> = {}) {
  const calls = { enable: 0, remove: 0, test: 0 };
  const device: DeviceApi = {
    supported: () => true,
    permission: () => "default",
    subscribed: async () => false,
    enable: async () => (calls.enable++, { ok: true }),
    remove: async () => void calls.remove++,
    test: async () => (calls.test++, { ok: true }),
    ...over,
  };
  return { device, calls };
}
const panel = (repo: PushSettingsRepo, device: DeviceApi) =>
  render(
    <ThemeProvider>
      <NotificationsPanel userId="u1" repo={repo} device={device} />
    </ThemeProvider>,
  );

describe("Notifications panel", () => {
  it("turns notifications on from a tap, asks the device, and saves enabled", async () => {
    const { repo, saved } = fakeRepo();
    const { device, calls } = fakeDevice();
    panel(repo, device);
    fireEvent.click(await screen.findByRole("button", { name: "Turn on notifications" }));
    await waitFor(() => expect(saved.at(-1)?.enabled).toBe(true));
    expect(calls.enable).toBe(1);
    expect(await screen.findByText(/Notifications are on/)).toBeTruthy();
  });

  it("shows nothing but guidance on a browser that cannot do push", async () => {
    const { repo } = fakeRepo();
    const { device } = fakeDevice({ supported: () => false, permission: () => "unsupported" });
    panel(repo, device);
    expect(await screen.findByText(/add Learivo to your Home Screen/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Turn on/ })).toBeNull();
  });

  it("explains how to unblock when permission was denied, and disables the button", async () => {
    const { repo } = fakeRepo();
    const { device } = fakeDevice({ permission: () => "denied" });
    panel(repo, device);
    expect(await screen.findByText(/blocked for Learivo/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Turn on notifications" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("shows the reason when turning on fails, and stays off", async () => {
    const { repo, saved } = fakeRepo();
    const { device } = fakeDevice({
      enable: async () => ({ ok: false, reason: "denied", message: "You blocked notifications." }),
    });
    panel(repo, device);
    fireEvent.click(await screen.findByRole("button", { name: "Turn on notifications" }));
    expect(await screen.findByText("You blocked notifications.")).toBeTruthy();
    expect(saved).toHaveLength(0);
  });

  const on: PushSettings = { ...DEFAULT_SETTINGS, enabled: true };
  const here = { subscribed: async () => true, permission: () => "granted" as const };

  it("sends a test and reports the result, good or bad", async () => {
    const { repo } = fakeRepo(on);
    const ok = fakeDevice(here);
    panel(repo, ok.device);
    fireEvent.click(await screen.findByRole("button", { name: "Send me a test" }));
    expect(await screen.findByText(/It should appear in a few seconds/)).toBeTruthy();
    expect(ok.calls.test).toBe(1);
    cleanup();
    const bad = fakeDevice({
      ...here,
      test: async () => ({ ok: false, message: "No device accepted it." }),
    });
    panel(repo, bad.device);
    fireEvent.click(await screen.findByRole("button", { name: "Send me a test" }));
    expect(await screen.findByText("No device accepted it.")).toBeTruthy();
  });

  it("saves the voice, the daily limit and switched-off topics", async () => {
    const { repo, saved } = fakeRepo(on);
    panel(repo, fakeDevice(here).device);
    fireEvent.click(await screen.findByRole("radio", { name: "Funny" }));
    await waitFor(() => expect(saved.at(-1)?.tone).toBe("funny"));
    fireEvent.click(screen.getByRole("radio", { name: "3" }));
    await waitFor(() => expect(saved.at(-1)?.maxPerDay).toBe(3));
    fireEvent.click(screen.getByRole("checkbox", { name: /Revision due/ }));
    await waitFor(() => expect(saved.at(-1)?.kinds).toEqual({ revision: false }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Revision due/ }));
    await waitFor(() => expect(saved.at(-1)?.kinds).toEqual({}));
  });

  it("warns when the study time is inside quiet hours", async () => {
    const { repo } = fakeRepo({ ...on, studyTime: "23:00" });
    panel(repo, fakeDevice(here).device);
    expect(await screen.findByText(/falls inside quiet hours/)).toBeTruthy();
  });

  it("offers the hour the student usually studies", async () => {
    const at = (day: number) => new Date(2026, 10, day, 7, 10).toISOString();
    const { repo, saved } = fakeRepo(on, [at(1), at(2), at(3)]);
    panel(repo, fakeDevice(here).device);
    fireEvent.click(await screen.findByRole("button", { name: "Use 7 am" }));
    await waitFor(() => expect(saved.at(-1)?.studyTime).toBe("07:00"));
  });

  it("turns off: saves disabled and removes this device", async () => {
    const { repo, saved } = fakeRepo(on);
    const { device, calls } = fakeDevice(here);
    panel(repo, device);
    fireEvent.click(await screen.findByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(calls.remove).toBe(1));
    expect(saved.at(-1)?.enabled).toBe(false);
  });

  it("offers to turn on for this phone when it is on for the account but not for this device", async () => {
    const { repo } = fakeRepo(on);
    panel(repo, fakeDevice({ subscribed: async () => false }).device);
    expect(await screen.findByRole("button", { name: "Turn on for this device" })).toBeTruthy();
  });
});

describe("Notifications invitation", () => {
  const invite = (over: Partial<Parameters<typeof PushInvite>[0]> = {}) => {
    const { repo, saved } = fakeRepo();
    const { device, calls } = fakeDevice();
    render(
      <ThemeProvider>
        <PushInvite
          userId="u1"
          repo={repo}
          device={device}
          supported
          permission="default"
          alreadyOn={false}
          {...over}
        />
      </ThemeProvider>,
    );
    return { saved, calls };
  };

  it("asks once, and turning on saves enabled", async () => {
    const { saved, calls } = invite();
    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(saved.at(-1)?.enabled).toBe(true));
    expect(calls.enable).toBe(1);
  });

  it("stays away for two weeks after Not now", async () => {
    invite();
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByLabelText("Notifications invitation")).toBeNull();
    cleanup();
    invite();
    expect(screen.queryByLabelText("Notifications invitation")).toBeNull();
  });

  it("treats closing the permission prompt like Not now", async () => {
    const { repo } = fakeRepo();
    const { device } = fakeDevice({
      enable: async () => ({ ok: false, reason: "dismissed", message: "" }),
    });
    render(
      <ThemeProvider>
        <PushInvite
          userId="u1"
          repo={repo}
          device={device}
          supported
          permission="default"
          alreadyOn={false}
        />
      </ThemeProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(screen.queryByLabelText("Notifications invitation")).toBeNull());
    cleanup();
    invite();
    expect(screen.queryByLabelText("Notifications invitation")).toBeNull();
  });

  it("never shows when unsupported, blocked, or already on", () => {
    for (const over of [
      { supported: false },
      { permission: "denied" as const },
      { permission: "granted" as const },
      { alreadyOn: true },
    ]) {
      invite(over);
      expect(screen.queryByLabelText("Notifications invitation")).toBeNull();
      cleanup();
    }
  });
});
