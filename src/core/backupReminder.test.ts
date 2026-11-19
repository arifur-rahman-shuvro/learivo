import { beforeEach, describe, expect, it } from "vitest";
import { markBackedUp, shouldRemindBackup, snoozeBackupReminder } from "./backupReminder.ts";

const DAY = 86_400_000;
const T = 1_800_000_000_000;

beforeEach(() => localStorage.clear());

describe("backup reminder", () => {
  it("stays quiet for a small bank", () => {
    expect(shouldRemindBackup(9, T)).toBe(false);
  });
  it("asks when there is a real bank and never a backup", () => {
    expect(shouldRemindBackup(10, T)).toBe(true);
  });
  it("is quiet for two weeks after a backup, then asks again", () => {
    markBackedUp(T);
    expect(shouldRemindBackup(50, T + 13 * DAY)).toBe(false);
    expect(shouldRemindBackup(50, T + 15 * DAY)).toBe(true);
  });
  it("is quiet for a week after Later", () => {
    snoozeBackupReminder(T);
    expect(shouldRemindBackup(50, T + 6 * DAY)).toBe(false);
    expect(shouldRemindBackup(50, T + 8 * DAY)).toBe(true);
  });
});
