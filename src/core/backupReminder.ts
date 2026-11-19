const LAST = "learivo.lastBackup";
const LATER = "learivo.backupLater";
const REMIND_AFTER_DAYS = 14;
const SNOOZE_DAYS = 7;
const DAY = 86_400_000;

const read = (key: string): number | null => {
  try {
    const v = Number(window.localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};
const write = (key: string, at: number) => {
  try {
    window.localStorage.setItem(key, String(at));
  } catch {
    // The reminder is a convenience; it must never break a backup.
  }
};

/** Remembers that a backup file was just saved. */
export function markBackedUp(now = Date.now()) {
  write(LAST, now);
}

/** "Not now": stay quiet for a week. */
export function snoozeBackupReminder(now = Date.now()) {
  write(LATER, now + SNOOZE_DAYS * DAY);
}

/**
 * True when there is enough in the bank to be worth saving, no backup has been made for two weeks
 * (or ever), and the student has not just said "later".
 */
export function shouldRemindBackup(questionCount: number, now = Date.now()): boolean {
  if (questionCount < 10) return false;
  const snoozed = read(LATER);
  if (snoozed !== null && snoozed > now) return false;
  const last = read(LAST);
  return last === null || now - last > REMIND_AFTER_DAYS * DAY;
}
