const KEY = "learivo.autoFlashcards";

/** Whether missed and skipped questions are turned into flashcards by themselves. On unless the student turns it off. */
export function autoFlashcardsOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setAutoFlashcards(on: boolean): void {
  try {
    if (on) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, "off");
  } catch {
    /* A browser that refuses storage keeps the default. */
  }
}
