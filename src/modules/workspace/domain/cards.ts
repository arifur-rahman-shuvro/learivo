import type { Card } from "./scheduler.ts";

/** A free-form flashcard the student wrote, revised with the same scheduler as questions. */
export interface Flashcard extends Card {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardInput {
  id: string | null;
  /** For a new card: the id to give it (made on the device when written offline). */
  newId?: string;
  front: string;
  back: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
}

export interface TermInput {
  id: string | null;
  /** For a new term: the id to give it (made on the device when written offline). */
  newId?: string;
  term: string;
  definition: string;
}

export const LIMITS = { front: 2000, back: 5000, term: 80, definition: 2000 } as const;

export function cleanFlashcard(input: FlashcardInput): FlashcardInput {
  const front = input.front.trim();
  const back = input.back.trim();
  if (front === "") throw new Error("Write the front of the card.");
  if (back === "") throw new Error("Write the back of the card.");
  if (front.length > LIMITS.front) throw new Error("The front is too long.");
  if (back.length > LIMITS.back) throw new Error("The back is too long.");
  return { id: input.id, front, back, ...(input.newId ? { newId: input.newId } : {}) };
}

export function cleanTerm(input: TermInput): TermInput {
  const term = input.term.trim();
  const definition = input.definition.trim();
  if (term === "") throw new Error("Write the term.");
  if (definition === "") throw new Error("Write what the term means.");
  if (term.length > LIMITS.term) throw new Error("The term is too long.");
  if (definition.length > LIMITS.definition) throw new Error("The definition is too long.");
  return { id: input.id, term, definition, ...(input.newId ? { newId: input.newId } : {}) };
}

/** Terms sorted for display, ignoring case. */
export function sortTerms(terms: readonly GlossaryTerm[]): GlossaryTerm[] {
  return [...terms].sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()));
}

/** Terms whose name or definition contains the search words. */
export function searchTerms(terms: readonly GlossaryTerm[], query: string): GlossaryTerm[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...terms];
  return terms.filter((t) => `${t.term}\n${t.definition}`.toLowerCase().includes(needle));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splits text into plain pieces and glossary hits so a screen can underline the terms.
 * Whole words only, ignoring case; longer terms win over shorter ones.
 */
export function splitByTerms(
  text: string,
  terms: readonly GlossaryTerm[],
): { text: string; term?: GlossaryTerm }[] {
  const usable = terms.filter((t) => t.term.trim().length >= 2);
  if (usable.length === 0 || text === "") return [{ text }];
  const byName = new Map(usable.map((t) => [t.term.trim().toLowerCase(), t]));
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escape);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${names.join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const out: { text: string; term?: GlossaryTerm }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index!;
    if (at > last) out.push({ text: text.slice(last, at) });
    out.push({ text: m[0], term: byName.get(m[0].toLowerCase()) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length === 0 ? [{ text }] : out;
}
