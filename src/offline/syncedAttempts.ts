import type { Fact } from "../modules/workspace/domain/insights.ts";
import type { Past } from "../modules/practice/domain/session.ts";
import { MemoryAttempts } from "../modules/practice/data/memoryAttempts.ts";
import type {
  Attempt,
  AttemptRepo,
  AttemptWithItems,
  Exam,
  ExamInput,
  Graded,
  ItemPatch,
  NewAttempt,
  Totals,
} from "../modules/practice/data/repo.ts";
import type { KeyValueStore } from "./store.ts";

/** One session recorded on this device that the database may not have yet. */
interface Pending {
  localId: string;
  input: NewAttempt;
  /** Set as soon as the database has created the session, so a retry never duplicates it. */
  remoteId: string | null;
}

interface Saved {
  pending: Pending[];
  /** Local id → database id, for sessions that finished syncing. */
  aliases: Record<string, string>;
  local: { seq: number; attempts: unknown[] };
}

export interface SyncState {
  /** Finished sessions waiting to be sent. */
  waiting: number;
  syncing: boolean;
  /** The last problem, until the next try works. */
  problem: string | null;
}

/**
 * Practice sessions are written on the device first and sent to the database when there is a
 * connection. A session therefore survives going offline, closing the app, or a failed request.
 */
export class SyncedAttempts implements AttemptRepo {
  private local = new MemoryAttempts("local");
  private pending: Pending[] = [];
  private aliases: Record<string, string> = {};
  private loaded?: Promise<void>;
  private running?: Promise<void>;
  private listeners = new Set<() => void>();
  private state: SyncState = { waiting: 0, syncing: false, problem: null };
  private examCache?: Exam[];
  /** Local sessions that have been submitted. */
  private done = new Set<string>();

  constructor(
    private readonly remote: AttemptRepo,
    private readonly store: KeyValueStore,
    private readonly userId: string,
    private readonly isOnline: () => boolean = () => navigator.onLine,
  ) {}

  private get key() {
    return `u:${this.userId}:attempts`;
  }
  private get examKey() {
    return `u:${this.userId}:exams`;
  }

  // ---- state, for the header indicator
  getState = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  private refreshWaiting() {
    this.setState({ waiting: this.pending.filter((p) => this.done.has(p.localId)).length });
  }

  // ---- loading and saving
  private ready() {
    this.loaded ??= (async () => {
      const saved = await this.store.get<Saved>(this.key);
      if (saved) {
        this.pending = saved.pending;
        this.aliases = saved.aliases;
        this.local.restore(saved.local);
        for (const a of saved.local.attempts as { id: string; status: string }[]) {
          if (a.status === "submitted") this.done.add(a.id);
        }
      }
      this.refreshWaiting();
    })();
    return this.loaded;
  }

  private async save() {
    const data: Saved = {
      pending: this.pending,
      aliases: this.aliases,
      local: this.local.dump() as Saved["local"],
    };
    await this.store.set(this.key, data);
  }

  private isLocal(id: string) {
    return id.startsWith("local-");
  }
  private remoteIdOf(id: string) {
    return this.aliases[id] ?? id;
  }

  // ---- sync
  /** Sends every finished session that is waiting. Safe to call at any time. */
  sync(): Promise<void> {
    this.running ??= this.runSync().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async runSync() {
    await this.ready();
    if (!this.pending.some((p) => this.finished(p)) || !this.isOnline()) return;
    this.setState({ syncing: true });
    try {
      for (const p of [...this.pending]) {
        if (!this.finished(p)) continue;
        await this.send(p);
      }
      this.setState({ problem: null });
    } catch (e) {
      this.setState({ problem: e instanceof Error ? e.message : "Could not send a session." });
    } finally {
      this.setState({ syncing: false });
      this.refreshWaiting();
    }
  }

  private finished(p: Pending) {
    return this.done.has(p.localId);
  }

  private async send(p: Pending) {
    const a = await this.local.get(p.localId);
    if (!a || a.status !== "submitted") return;
    if (!p.remoteId) {
      p.remoteId = await this.remote.create({ ...p.input, startedAt: a.startedAt });
      await this.save(); // remember it before anything else can fail
    }
    const remoteId = p.remoteId;
    const there = await this.remote.get(remoteId);
    if (there && there.status !== "submitted") {
      for (const item of a.items) {
        if (item.response !== null || item.flagged) {
          await this.remote.patchItem(remoteId, item.position, {
            response: item.response,
            flagged: item.flagged,
          });
        }
      }
      const graded: Graded[] = a.items.flatMap((i) =>
        i.verdict ? [{ position: i.position, verdict: i.verdict, marks: i.marks ?? 0 }] : [],
      );
      await this.remote.submit(remoteId, graded, {
        score: a.score ?? 0,
        correct: a.correct ?? 0,
        wrong: a.wrong ?? 0,
        unanswered: a.unanswered ?? 0,
        secondsSpent: a.secondsSpent,
        submittedAt: a.submittedAt ?? undefined,
      });
    }
    this.aliases[p.localId] = remoteId;
    this.pending = this.pending.filter((x) => x.localId !== p.localId);
    this.done.delete(p.localId);
    await this.local.remove(p.localId);
    await this.save();
  }

  // ---- AttemptRepo
  async create(input: NewAttempt) {
    await this.ready();
    const localId = await this.local.create(input);
    this.pending.push({ localId, input, remoteId: null });
    await this.save();
    return localId;
  }

  async get(id: string): Promise<AttemptWithItems | null> {
    await this.ready();
    if (this.isLocal(id) && !this.aliases[id]) return this.local.get(id);
    return this.remote.get(this.remoteIdOf(id));
  }

  async list(limit: number): Promise<Attempt[]> {
    await this.ready();
    const mine = await this.local.list(limit);
    let theirs: Attempt[] = [];
    try {
      theirs = await this.remote.list(limit);
    } catch (e) {
      if (mine.length === 0) throw e;
    }
    return [...mine, ...theirs]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  async patchItem(attemptId: string, position: number, patch: ItemPatch) {
    await this.ready();
    if (this.isLocal(attemptId) && !this.aliases[attemptId]) {
      await this.local.patchItem(attemptId, position, patch);
      await this.save();
      return;
    }
    await this.remote.patchItem(this.remoteIdOf(attemptId), position, patch);
  }

  async submit(attemptId: string, graded: Graded[], totals: Totals) {
    await this.ready();
    if (this.isLocal(attemptId) && !this.aliases[attemptId]) {
      await this.local.submit(attemptId, graded, totals);
      this.done.add(attemptId);
      await this.save();
      this.refreshWaiting();
      await this.sync();
      return;
    }
    await this.remote.submit(this.remoteIdOf(attemptId), graded, totals);
  }

  async remove(attemptId: string) {
    await this.ready();
    if (this.isLocal(attemptId) && !this.aliases[attemptId]) {
      await this.local.remove(attemptId);
      this.pending = this.pending.filter((p) => p.localId !== attemptId);
      this.done.delete(attemptId);
      await this.save();
      this.refreshWaiting();
      return;
    }
    await this.remote.remove(this.remoteIdOf(attemptId));
  }

  async facts(limit: number): Promise<Fact[]> {
    await this.ready();
    const mine = await this.local.facts(limit);
    let theirs: Fact[] = [];
    try {
      theirs = await this.remote.facts(limit);
    } catch (e) {
      if (mine.length === 0) throw e;
    }
    return [...mine, ...theirs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  async past(): Promise<Map<string, Past>> {
    await this.ready();
    let theirs = new Map<string, Past>();
    try {
      theirs = await this.remote.past();
    } catch (e) {
      if (this.pending.length === 0) throw e;
    }
    // Sessions waiting to be sent count as the latest answers.
    for (const [qid, p] of await this.local.past()) {
      theirs.set(qid, { last: p.last, times: (theirs.get(qid)?.times ?? 0) + p.times });
    }
    return theirs;
  }

  /** Exams are kept on the device after each successful read, so they can be taken offline. */
  async exams(): Promise<Exam[]> {
    await this.ready();
    try {
      const list = await this.remote.exams();
      this.examCache = list;
      await this.store.set(this.examKey, list);
      return list;
    } catch (e) {
      this.examCache ??= await this.store.get<Exam[]>(this.examKey);
      if (this.examCache) return this.examCache;
      throw e;
    }
  }

  saveExam(id: string | null, input: ExamInput) {
    return this.remote.saveExam(id, input);
  }
  deleteExam(id: string) {
    return this.remote.deleteExam(id);
  }

  /** Clears what is kept for exams on sign-out. Sessions still waiting to be sent are kept. */
  async clearCaches() {
    await this.store.del(this.examKey);
    this.examCache = undefined;
  }
}
