/** A flag in this browser: someone has signed in here before, so the sign-in screen can come first. */
const KEY = "learivo.returning";

export function isReturning(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markReturning(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Without storage the introduction simply shows again.
  }
}
