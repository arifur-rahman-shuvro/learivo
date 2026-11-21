import { reportError } from "../../core/monitoring.ts";
import {
  cleanFlashcard,
  cleanTerm,
  sortTerms,
  type Flashcard,
  type FlashcardInput,
  type GlossaryTerm,
  type TermInput,
} from "../../modules/workspace/domain/cards.ts";
import { NO_EXAM, type ExamTarget } from "../../modules/workspace/domain/examTarget.ts";
import { DEFAULT_HOME_LAYOUT, type HomeLayout } from "../../modules/workspace/domain/homeLayout.ts";
import { newCard, type Card } from "../../modules/workspace/domain/scheduler.ts";
import {
  DEFAULT_GOAL,
  type CardRecord,
  type Note,
  type NoteInput,
  type WorkspaceRepo,
} from "../../modules/workspace/data/repo.ts";
import { isTransient } from "./edits.ts";
import type { KeyValueStore } from "./store.ts";

/**
 * Changes to notes, bookmarks, revision cards, flashcards, the glossary and the settings on Home,
 * made while offline. The last change to the same thing wins; nothing here merges two versions.
 */
export type WsOp =
  | { k: "bookmark"; q: string; on: boolean }
  | { k: "note"; input: NoteInput; localId: string; at: string }
  | { k: "noteDel"; id: string }
  | { k: "addCards"; ids: string[]; at: string }
  | { k: "saveCard"; q: string; card: Card }
  | { k: "removeCard"; q: string }
  | { k: "goal"; n: number }
  | { k: "flash"; input: FlashcardInput; localId: string }
  | { k: "rate"; id: string; card: Card }
  | { k: "flashDel"; id: string }
  | { k: "term"; input: TermInput; localId: string }
  | { k: "termDel"; id: string }
  | { k: "exam"; target: ExamTarget }
  | { k: "layout"; layout: HomeLayout };

interface Cache {
  bookmarks?: string[];
  notes?: Note[];
  cards?: CardRecord[];
  flashcards?: Flashcard[];
  glossary?: GlossaryTerm[];
  goal?: number;
  exam?: ExamTarget;
  layout?: HomeLayout;
}

const cacheKey = (u: string) => `u:${u}:ws-cache`;
const queueKey = (u: string) => `u:${u}:ws-queue`;
const MESSAGE =
  "You are offline and this has not been opened on this device yet. Open it once while online.";

export const wsSummary = (op: WsOp): string => {
  switch (op.k) {
    case "bookmark":
      return op.on ? "Save a question" : "Remove a saved question";
    case "note":
      return `Note: ${op.input.title || op.input.body.slice(0, 40)}`;
    case "noteDel":
      return "Delete a note";
    case "addCards":
      return `Add ${op.ids.length} question${op.ids.length === 1 ? "" : "s"} to revision`;
    case "saveCard":
      return "Revision result";
    case "removeCard":
      return "Remove a question from revision";
    case "goal":
      return `Daily goal: ${op.n}`;
    case "flash":
      return `Flashcard: ${op.input.front.slice(0, 40)}`;
    case "rate":
      return "Flashcard result";
    case "flashDel":
      return "Delete a flashcard";
    case "term":
      return `Glossary: ${op.input.term}`;
    case "termDel":
      return "Delete a glossary term";
    case "exam":
      return "Exam date";
    case "layout":
      return "Home layout";
  }
};

/** Keeps only the newest of changes that replace each other, so the list stays short. */
export function enqueueWs(queue: WsOp[], op: WsOp): WsOp[] {
  const same = (o: WsOp) => {
    switch (op.k) {
      case "bookmark":
        return o.k === "bookmark" && o.q === op.q;
      case "saveCard":
        return o.k === "saveCard" && o.q === op.q;
      case "rate":
        return o.k === "rate" && o.id === op.id;
      case "note":
      case "flash":
      case "term":
        return o.k === op.k && o.localId === op.localId;
      case "goal":
      case "exam":
      case "layout":
        return o.k === op.k;
      default:
        return false;
    }
  };
  return [...queue.filter((o) => !same(o)), op];
}

/** Lays one change over the cached lists. */
export function applyWs(c: Cache, op: WsOp): void {
  switch (op.k) {
    case "bookmark":
      if (c.bookmarks)
        c.bookmarks = op.on
          ? [...new Set([...c.bookmarks, op.q])]
          : c.bookmarks.filter((x) => x !== op.q);
      break;
    case "note":
      if (c.notes) {
        const old = c.notes.find((n) => n.id === op.localId);
        const note: Note = {
          id: op.localId,
          questionId: old?.questionId ?? op.input.questionId,
          title: op.input.title,
          body: op.input.body,
          updatedAt: op.at,
        };
        c.notes = [note, ...c.notes.filter((n) => n.id !== note.id)];
      }
      break;
    case "noteDel":
      if (c.notes) c.notes = c.notes.filter((n) => n.id !== op.id);
      break;
    case "addCards":
      if (c.cards) {
        const have = new Set(c.cards.map((x) => x.questionId));
        c.cards = [
          ...c.cards,
          ...[...new Set(op.ids)]
            .filter((q) => !have.has(q))
            .map((q) => ({ questionId: q, ...newCard(new Date(op.at)) })),
        ];
      }
      break;
    case "saveCard":
      if (c.cards)
        c.cards = [
          ...c.cards.filter((x) => x.questionId !== op.q),
          { questionId: op.q, ...structuredClone(op.card) },
        ];
      break;
    case "removeCard":
      if (c.cards) c.cards = c.cards.filter((x) => x.questionId !== op.q);
      break;
    case "goal":
      c.goal = op.n;
      break;
    case "flash":
      if (c.flashcards) {
        const old = c.flashcards.find((f) => f.id === op.localId);
        const card: Flashcard = {
          ...(old ?? { ...newCard(new Date()) }),
          id: op.localId,
          front: op.input.front,
          back: op.input.back,
        };
        c.flashcards = [card, ...c.flashcards.filter((f) => f.id !== card.id)];
      }
      break;
    case "rate":
      if (c.flashcards)
        c.flashcards = c.flashcards.map((f) =>
          f.id === op.id ? { ...f, ...structuredClone(op.card) } : f,
        );
      break;
    case "flashDel":
      if (c.flashcards) c.flashcards = c.flashcards.filter((f) => f.id !== op.id);
      break;
    case "term":
      if (c.glossary) {
        const t: GlossaryTerm = {
          id: op.localId,
          term: op.input.term,
          definition: op.input.definition,
        };
        c.glossary = sortTerms([...c.glossary.filter((x) => x.id !== t.id), t]);
      }
      break;
    case "termDel":
      if (c.glossary) c.glossary = c.glossary.filter((t) => t.id !== op.id);
      break;
    case "exam":
      c.exam = op.target;
      break;
    case "layout":
      c.layout = op.layout;
      break;
  }
}

/**
 * The workspace (notes, bookmarks, revision, flashcards, glossary, goal) that keeps working
 * without a connection. Reads come from the account when online and from a copy on this device
 * otherwise; changes are sent at once when possible and kept in order on the device when not.
 */
export class OfflineWorkspace implements WorkspaceRepo {
  private cache: Cache = {};
  private queue: WsOp[] = [];
  private loaded = false;
  private flushing?: Promise<void>;
  private listeners = new Set<() => void>();
  failed: string[] = [];

  constructor(
    private readonly remote: WorkspaceRepo,
    private readonly store: KeyValueStore,
    private readonly userId: string,
    private readonly isOnline: () => boolean = () => navigator.onLine,
  ) {}

  private async load() {
    if (this.loaded) return;
    this.cache = (await this.store.get<Cache>(cacheKey(this.userId))) ?? {};
    const q = await this.store.get<unknown>(queueKey(this.userId));
    this.queue = Array.isArray(q) ? (q as WsOp[]).filter((o) => o && typeof o.k === "string") : [];
    this.loaded = true;
  }

  private async save() {
    await this.store.set(cacheKey(this.userId), this.cache);
    await this.store.set(queueKey(this.userId), this.queue);
  }

  private changed() {
    this.listeners.forEach((l) => l());
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** Changes waiting to be sent, one line each. */
  async pendingSummaries(): Promise<string[]> {
    await this.load();
    return this.queue.map(wsSummary);
  }

  async waiting(): Promise<number> {
    await this.load();
    return this.queue.length;
  }

  /** Sends waiting changes in order; stops at the first connection problem. */
  flush(): Promise<void> {
    this.flushing ??= this.runFlush().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  private async runFlush() {
    await this.load();
    let touched = false;
    while (this.queue.length > 0 && this.isOnline()) {
      const op = this.queue[0]!;
      try {
        await this.send(op);
      } catch (e) {
        if (isTransient(e)) break;
        this.failed.push(`${wsSummary(op)}: ${e instanceof Error ? e.message : "refused"}`);
        reportError(new Error(`Offline workspace change refused (${op.k})`));
      }
      touched = true;
      this.queue.shift();
      await this.save();
    }
    if (touched) this.changed();
  }

  private async send(op: WsOp) {
    const r = this.remote;
    switch (op.k) {
      case "bookmark":
        return r.setBookmark(op.q, op.on);
      case "note":
        await r.saveNote(op.input);
        return;
      case "noteDel":
        return r.deleteNote(op.id);
      case "addCards":
        return r.addCards(op.ids);
      case "saveCard":
        return r.saveCard(op.q, op.card);
      case "removeCard":
        return r.removeCard(op.q);
      case "goal":
        return r.setDailyGoal(op.n);
      case "flash":
        await r.saveFlashcard(op.input);
        return;
      case "rate":
        return r.rateFlashcard(op.id, op.card);
      case "flashDel":
        return r.deleteFlashcard(op.id);
      case "term":
        await r.saveTerm(op.input);
        return;
      case "termDel":
        return r.deleteTerm(op.id);
      case "exam":
        return r.setExamTarget(op.target);
      case "layout":
        return r.setHomeLayout(op.layout);
    }
  }

  /** Online: the account's answer (after sending anything waiting). Offline or unreachable: the copy on this device. */
  private async read<K extends keyof Cache, T>(
    key: K,
    fetch: () => Promise<T>,
    store: (v: T) => Cache[K],
    out: (c: NonNullable<Cache[K]>) => T,
  ): Promise<T> {
    await this.load();
    if (this.isOnline()) {
      if (this.queue.length > 0) await this.flush().catch(() => undefined);
      if (this.queue.length === 0) {
        try {
          const v = await fetch();
          this.cache[key] = store(v);
          await this.save();
          return v;
        } catch (e) {
          if (!isTransient(e) || this.cache[key] === undefined) throw e;
        }
      }
    }
    const c = this.cache[key];
    if (c === undefined) throw new Error(MESSAGE);
    return out(c as NonNullable<Cache[K]>);
  }

  /** Sends the change now when it can be; otherwise keeps it on the device and shows it at once. */
  private async write<T>(op: WsOp, direct: () => Promise<T>, local: () => T): Promise<T> {
    await this.load();
    if (this.isOnline() && this.queue.length === 0) {
      try {
        const r = await direct();
        applyWs(this.cache, op);
        await this.save();
        this.changed();
        return r;
      } catch (e) {
        if (!isTransient(e)) throw e;
      }
    }
    this.queue = enqueueWs(this.queue, op);
    applyWs(this.cache, op);
    await this.save();
    this.changed();
    if (this.isOnline()) void this.flush().catch(() => undefined);
    return local();
  }

  // ---------------------------------------------------------------- bookmarks
  bookmarks = () =>
    this.read(
      "bookmarks",
      () => this.remote.bookmarks(),
      (s) => [...s],
      (c) => new Set(c),
    );
  setBookmark = (q: string, on: boolean) =>
    this.write(
      { k: "bookmark", q, on },
      () => this.remote.setBookmark(q, on),
      () => undefined,
    );

  // -------------------------------------------------------------------- notes
  notes = () =>
    this.read(
      "notes",
      () => this.remote.notes(),
      (n) => n,
      (c) => structuredClone(c),
    );
  /**
   * The id to send and the id to show for something saved now. A new item gets an id made here, so
   * saving it twice offline is one change; editing an item that is still waiting to be created
   * keeps it a creation. An item the account already has is edited by its own id.
   */
  private ids(kind: "note" | "flash" | "term", id: string | null) {
    if (id === null) {
      const made = crypto.randomUUID();
      return { id: null, newId: made, localId: made };
    }
    const waiting = this.queue.find(
      (o): o is Extract<WsOp, { k: "note" | "flash" | "term" }> =>
        o.k === kind && o.localId === id && o.input.id === null,
    );
    if (waiting) return { id: null, newId: waiting.input.newId, localId: id };
    return { id, newId: undefined, localId: id };
  }

  async saveNote(input: NoteInput): Promise<Note> {
    if (input.body.trim() === "") throw new Error("Write something in the note.");
    await this.load();
    // One note per question: writing again edits the one that is there.
    const have =
      input.id === null && input.questionId
        ? this.cache.notes?.find((n) => n.questionId === input.questionId)
        : undefined;
    const ids = this.ids("note", input.id ?? have?.id ?? null);
    const sent: NoteInput = {
      ...input,
      id: ids.id,
      ...(ids.newId ? { newId: ids.newId } : {}),
    };
    const at = new Date().toISOString();
    const note: Note = {
      id: ids.localId,
      questionId: input.questionId,
      title: input.title,
      body: input.body,
      updatedAt: at,
    };
    return this.write(
      { k: "note", input: sent, localId: ids.localId, at },
      () => this.remote.saveNote(sent),
      () => note,
    );
  }
  deleteNote = (id: string) =>
    this.write(
      { k: "noteDel", id },
      () => this.remote.deleteNote(id),
      () => undefined,
    );

  // -------------------------------------------------------- revision (cards)
  cards = () =>
    this.read(
      "cards",
      () => this.remote.cards(),
      (c) => c,
      (c) => structuredClone(c),
    );
  addCards = (ids: string[]) => {
    const at = new Date().toISOString();
    return this.write(
      { k: "addCards", ids, at },
      () => this.remote.addCards(ids),
      () => undefined,
    );
  };
  saveCard = (q: string, card: Card) =>
    this.write(
      { k: "saveCard", q, card },
      () => this.remote.saveCard(q, card),
      () => undefined,
    );
  removeCard = (q: string) =>
    this.write(
      { k: "removeCard", q },
      () => this.remote.removeCard(q),
      () => undefined,
    );

  // --------------------------------------------------------------------- goal
  dailyGoal = () =>
    this.read(
      "goal",
      () => this.remote.dailyGoal(),
      (n) => n,
      (n) => n || DEFAULT_GOAL,
    );
  setDailyGoal = (n: number) =>
    this.write(
      { k: "goal", n },
      () => this.remote.setDailyGoal(n),
      () => undefined,
    );

  // --------------------------------------------------------------- flashcards
  flashcards = () =>
    this.read(
      "flashcards",
      () => this.remote.flashcards(),
      (f) => f,
      (c) => structuredClone(c),
    );
  async saveFlashcard(input: FlashcardInput): Promise<Flashcard> {
    const clean = cleanFlashcard(input);
    await this.load();
    const ids = this.ids("flash", clean.id);
    const sent: FlashcardInput = {
      ...clean,
      id: ids.id,
      ...(ids.newId ? { newId: ids.newId } : {}),
    };
    const old = this.cache.flashcards?.find((f) => f.id === ids.localId);
    const card: Flashcard = {
      ...(old ?? newCard(new Date())),
      id: ids.localId,
      front: clean.front,
      back: clean.back,
    };
    return this.write(
      { k: "flash", input: sent, localId: ids.localId },
      () => this.remote.saveFlashcard(sent),
      () => card,
    );
  }
  rateFlashcard = (id: string, card: Card) =>
    this.write(
      { k: "rate", id, card },
      () => this.remote.rateFlashcard(id, card),
      () => undefined,
    );
  deleteFlashcard = (id: string) =>
    this.write(
      { k: "flashDel", id },
      () => this.remote.deleteFlashcard(id),
      () => undefined,
    );

  // ----------------------------------------------------------------- glossary
  glossary = () =>
    this.read(
      "glossary",
      () => this.remote.glossary(),
      (g) => g,
      (c) => structuredClone(c),
    );
  async saveTerm(input: TermInput): Promise<GlossaryTerm> {
    const clean = cleanTerm(input);
    await this.load();
    const ids = this.ids("term", clean.id);
    const dup = this.cache.glossary?.find(
      (t) =>
        t.id !== ids.localId && t.term.trim().toLowerCase() === clean.term.trim().toLowerCase(),
    );
    if (dup && !this.isOnline()) throw new Error("You already have a term with that name.");
    const sent: TermInput = {
      ...clean,
      id: ids.id,
      ...(ids.newId ? { newId: ids.newId } : {}),
    };
    const term: GlossaryTerm = {
      id: ids.localId,
      term: clean.term,
      definition: clean.definition,
    };
    return this.write(
      { k: "term", input: sent, localId: ids.localId },
      () => this.remote.saveTerm(sent),
      () => term,
    );
  }
  deleteTerm = (id: string) =>
    this.write(
      { k: "termDel", id },
      () => this.remote.deleteTerm(id),
      () => undefined,
    );

  // ------------------------------------------------------ exam and Home layout
  examTarget = () =>
    this.read(
      "exam",
      () => this.remote.examTarget(),
      (e) => e,
      (c) => c ?? NO_EXAM,
    );
  setExamTarget = (target: ExamTarget) =>
    this.write(
      { k: "exam", target },
      () => this.remote.setExamTarget(target),
      () => undefined,
    );
  homeLayout = () =>
    this.read(
      "layout",
      () => this.remote.homeLayout(),
      (l) => l,
      (c) => c ?? DEFAULT_HOME_LAYOUT,
    );
  setHomeLayout = (layout: HomeLayout) =>
    this.write(
      { k: "layout", layout },
      () => this.remote.setHomeLayout(layout),
      () => undefined,
    );

  /** Forgets everything kept on this device (sign-out or clearing data). */
  async clear() {
    this.cache = {};
    this.queue = [];
    this.failed = [];
    this.loaded = false;
    await this.store.del(cacheKey(this.userId));
    await this.store.del(queueKey(this.userId));
  }
}
