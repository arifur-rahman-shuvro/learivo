/** Seconds to wait before try number `attempt` (0 is the first retry): 2, 4, 8 ... capped at 5 minutes. */
export function retryDelay(attempt: number): number {
  return Math.min(300, 2 * 2 ** Math.max(0, attempt));
}

export interface RetryState {
  /** Tries made since the last success or fresh start. */
  attempt: number;
  /** When the next try runs (ms since 1970), or null when none is planned. */
  nextAt: number | null;
}

export interface Retrier {
  getState(): RetryState;
  subscribe(fn: () => void): () => void;
  /** Try now (a connection came back, or the app was opened) and start the waiting over. */
  kick(): void;
  stop(): void;
}

/**
 * Keeps trying to send what is waiting, a little less often each time, so a flaky connection is
 * not hammered and a good one recovers quickly. `run` returns true when nothing is left to send.
 */
export function createRetrier(
  run: () => Promise<boolean>,
  isOnline: () => boolean,
  timer: {
    set: (fn: () => void, ms: number) => unknown;
    clear: (h: unknown) => void;
    now: () => number;
  } = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    now: () => Date.now(),
  },
): Retrier {
  let state: RetryState = { attempt: 0, nextAt: null };
  let handle: unknown = null;
  let stopped = false;
  const listeners = new Set<() => void>();
  const set = (s: RetryState) => {
    state = s;
    listeners.forEach((l) => l());
  };

  async function attempt() {
    handle = null;
    if (stopped) return;
    let done: boolean;
    try {
      done = await run();
    } catch {
      done = false;
    }
    if (stopped) return;
    if (done || !isOnline()) {
      // Nothing left, or no connection: wait for the next "online" signal instead of polling.
      set({ attempt: 0, nextAt: null });
      return;
    }
    const wait = retryDelay(state.attempt) * 1000;
    set({ attempt: state.attempt + 1, nextAt: timer.now() + wait });
    handle = timer.set(() => void attempt(), wait);
  }

  return {
    getState: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    kick() {
      if (handle !== null) timer.clear(handle);
      handle = null;
      stopped = false;
      state = { attempt: 0, nextAt: null };
      void attempt();
    },
    stop() {
      stopped = true;
      if (handle !== null) timer.clear(handle);
      handle = null;
    },
  };
}
