/**
 * Small key-value store for data kept on this device (offline pack, unsynced sessions).
 * The app uses IndexedDB; tests use the in-memory version.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  /** Keys that start with the prefix. */
  keys(prefix: string): Promise<string[]>;
}

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, unknown>();
  async get<T>(key: string) {
    return this.map.has(key) ? (structuredClone(this.map.get(key)) as T) : undefined;
  }
  async set(key: string, value: unknown) {
    this.map.set(key, structuredClone(value));
  }
  async del(key: string) {
    this.map.delete(key);
  }
  async keys(prefix: string) {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
}

const DB = "learivo-offline";
const TABLE = "kv";

export class IndexedDbStore implements KeyValueStore {
  private opened?: Promise<IDBDatabase>;

  constructor(private readonly factory: IDBFactory = indexedDB) {}

  private open(): Promise<IDBDatabase> {
    this.opened ??= new Promise((resolve, reject) => {
      const req = this.factory.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(TABLE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Could not open device storage."));
    });
    return this.opened;
  }

  private async run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(TABLE, mode);
      const req = fn(tx.objectStore(TABLE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error("Could not use device storage."));
      tx.onabort = () => reject(tx.error ?? new Error("Device storage is full or blocked."));
    });
  }

  get<T>(key: string) {
    return this.run("readonly", (s) => s.get(key)) as Promise<T | undefined>;
  }
  async set(key: string, value: unknown) {
    await this.run("readwrite", (s) => s.put(value, key));
  }
  async del(key: string) {
    await this.run("readwrite", (s) => s.delete(key));
  }
  async keys(prefix: string) {
    const all = (await this.run("readonly", (s) => s.getAllKeys())) as IDBValidKey[];
    return all.map(String).filter((k) => k.startsWith(prefix));
  }
}

/** Device storage for the real app; falls back to memory where IndexedDB is missing. */
export function deviceStore(): KeyValueStore {
  return typeof indexedDB === "undefined" ? new MemoryStore() : new IndexedDbStore();
}
