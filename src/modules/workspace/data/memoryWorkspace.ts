import {
  cleanFlashcard,
  cleanTerm,
  sortTerms,
  type Flashcard,
  type FlashcardInput,
  type GlossaryTerm,
  type TermInput,
} from "../domain/cards.ts";
import { NO_EXAM, cleanExamTarget, type ExamTarget } from "../domain/examTarget.ts";
import { DEFAULT_HOME_LAYOUT, cleanLayout, type HomeLayout } from "../domain/homeLayout.ts";
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
  private layout: HomeLayout = DEFAULT_HOME_LAYOUT;
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
    const id = existing?.id ?? input.newId ?? `note-${++this.seq}`;
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

  private cardsMap = new Map<string, Flashcard>();
  private termMap = new Map<string, GlossaryTerm>();

  async flashcards() {
    return structuredClone([...this.cardsMap.values()].reverse());
  }
  async saveFlashcard(input: FlashcardInput) {
    const clean = cleanFlashcard(input);
    const existing = clean.id ? this.cardsMap.get(clean.id) : undefined;
    if (clean.id && !existing) throw new Error("That card no longer exists.");
    const id = existing?.id ?? clean.newId ?? `flash-${++this.seq}`;
    const card: Flashcard = existing
      ? { ...existing, front: clean.front, back: clean.back }
      : { id, front: clean.front, back: clean.back, ...newCard(new Date()) };
    this.cardsMap.set(id, card);
    return structuredClone(card);
  }
  async rateFlashcard(id: string, card: Card) {
    const existing = this.cardsMap.get(id);
    if (!existing) throw new Error("That card no longer exists.");
    this.cardsMap.set(id, { ...existing, ...structuredClone(card) });
  }
  async deleteFlashcard(id: string) {
    this.cardsMap.delete(id);
  }

  async glossary() {
    return sortTerms(structuredClone([...this.termMap.values()]));
  }
  async saveTerm(input: TermInput) {
    const clean = cleanTerm(input);
    const clash = [...this.termMap.values()].find(
      (t) => t.id !== clean.id && t.term.toLowerCase() === clean.term.toLowerCase(),
    );
    if (clash) throw new Error("You already have a term with that name.");
    const id = clean.id ?? clean.newId ?? `term-${++this.seq}`;
    if (clean.id && !this.termMap.has(clean.id)) throw new Error("That term no longer exists.");
    const term: GlossaryTerm = { id, term: clean.term, definition: clean.definition };
    this.termMap.set(id, term);
    return structuredClone(term);
  }
  async deleteTerm(id: string) {
    this.termMap.delete(id);
  }

  private exam: ExamTarget = NO_EXAM;
  async examTarget() {
    return { ...this.exam };
  }
  async setExamTarget(target: ExamTarget) {
    this.exam = cleanExamTarget(target);
  }

  async homeLayout() {
    return structuredClone(this.layout);
  }
  async setHomeLayout(layout: HomeLayout) {
    this.layout = cleanLayout(layout);
  }
}
