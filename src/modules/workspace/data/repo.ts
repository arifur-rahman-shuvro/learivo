import type { Card } from "../domain/scheduler.ts";

export interface Note {
  id: string;
  /** The question this note belongs to, or null for a free note. */
  questionId: string | null;
  title: string;
  body: string;
  updatedAt: string;
}

export interface NoteInput {
  id: string | null;
  questionId: string | null;
  title: string;
  body: string;
}

export interface CardRecord extends Card {
  questionId: string;
}

export interface WorkspaceRepo {
  bookmarks(): Promise<Set<string>>;
  setBookmark(questionId: string, on: boolean): Promise<void>;

  /** Newest first. */
  notes(): Promise<Note[]>;
  saveNote(input: NoteInput): Promise<Note>;
  deleteNote(id: string): Promise<void>;

  cards(): Promise<CardRecord[]>;
  /** Adds cards that are due now; questions that already have a card are left alone. */
  addCards(questionIds: string[]): Promise<void>;
  saveCard(questionId: string, card: Card): Promise<void>;
  removeCard(questionId: string): Promise<void>;

  dailyGoal(): Promise<number>;
  setDailyGoal(n: number): Promise<void>;

  /** Newest first. */
  flashcards(): Promise<Flashcard[]>;
  saveFlashcard(input: FlashcardInput): Promise<Flashcard>;
  /** Stores the card's new schedule after a rating. */
  rateFlashcard(id: string, card: Card): Promise<void>;
  deleteFlashcard(id: string): Promise<void>;

  /** Sorted by term. */
  glossary(): Promise<GlossaryTerm[]>;
  saveTerm(input: TermInput): Promise<GlossaryTerm>;
  deleteTerm(id: string): Promise<void>;

  examTarget(): Promise<ExamTarget>;
  setExamTarget(target: ExamTarget): Promise<void>;

  homeLayout(): Promise<HomeLayout>;
  setHomeLayout(layout: HomeLayout): Promise<void>;
}

import type { Flashcard, FlashcardInput, GlossaryTerm, TermInput } from "../domain/cards.ts";
import type { ExamTarget } from "../domain/examTarget.ts";
import type { HomeLayout } from "../domain/homeLayout.ts";

export const DEFAULT_GOAL = 20;
