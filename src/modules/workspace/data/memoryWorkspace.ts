import { newCard, type Card } from "../domain/scheduler.ts";
import {
  DEFAULT_GOAL,
  type CardRecord,
  type Note,
  type NoteInput,
  type WorkspaceRepo,
} from "./repo.ts";

/** In-memory workspace for tests and demos; follows the same rules as the database. */
export class MemoryWorkspace implements WorkspaceRepo {
  private marks = new Set<string>();
  private noteMap = new Map<string, Note>();
  private cardMap = new Map<string, Card>();
  private goal = DEFAULT_GOAL;
  private seq = 0;
  private clock = Date.now();

  private tick() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  async bookmarks() {
    return new Set(this.marks);
  }
  async setBookmark(questionId: string, on: boolean) {
    if (on) this.marks.add(questionId);
    else this.marks.delete(questionId);
  }

  async notes() {
    return structuredClone(
      [...this.noteMap.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }
  async saveNote(input: NoteInput) {
    if (input.body.trim() === "") throw new Error("Write something in the note.");
    if (input.title.length > 120) throw new Error("The title is too long.");
    if (input.body.length > 10000) throw new Error("The note is too long.");
    const existing =
      input.id !== null
        ? this.noteMap.get(input.id)
        : input.questionId !== null
          ? [...this.noteMap.values()].find((n) => n.questionId === input.questionId)
          : undefined;
    const id = existing?.id ?? `note-${++this.seq}`;
    const note: Note = {
      id,
      questionId: input.questionId,
      title: input.title,
      body: input.body,
      updatedAt: this.tick(),
    };
    this.noteMap.set(id, note);
    return structuredClone(note);
  }
  async deleteNote(id: string) {
    this.noteMap.delete(id);
  }

  async cards(): Promise<CardRecord[]> {
    return [...this.cardMap.entries()].map(([questionId, c]) => ({
      questionId,
      ...structuredClone(c),
    }));
  }
  async addCards(questionIds: string[]) {
    for (const id of questionIds)
      if (!this.cardMap.has(id)) this.cardMap.set(id, newCard(new Date()));
  }
  async saveCard(questionId: string, card: Card) {
    this.cardMap.set(questionId, structuredClone(card));
  }
  async removeCard(questionId: string) {
    this.cardMap.delete(questionId);
  }

  async dailyGoal() {
    return this.goal;
  }
  async setDailyGoal(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > 500) throw new Error("Choose a goal from 1 to 500.");
    this.goal = n;
  }
}
