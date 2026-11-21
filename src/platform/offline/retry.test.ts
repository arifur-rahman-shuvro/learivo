import { describe, expect, it } from "vitest";
import { createRetrier, retryDelay } from "./retry.ts";

/** A clock the test moves by hand. */
function clock() {
  let t = 1_000;
  const jobs: { at: number; fn: () => void; id: number }[] = [];
  let n = 0;
  return {
    timer: {
      set: (fn: () => void, ms: number) => {
        const id = ++n;
        jobs.push({ at: t + ms, fn, id });
        return id;
      },
      clear: (h: unknown) => {
        const i = jobs.findIndex((j) => j.id === h);
        if (i >= 0) jobs.splice(i, 1);
      },
      now: () => t,
    },
    pending: () => jobs.map((j) => j.at - t),
    async advance(ms: number) {
      t += ms;
      for (const j of jobs.filter((x) => x.at <= t)) {
        jobs.splice(jobs.indexOf(j), 1);
        j.fn();
        await Promise.resolve();
        await Promise.resolve();
      }
    },
  };
}

describe("retryDelay", () => {
  it("doubles from 2 seconds and stops at 5 minutes", () => {
    expect([0, 1, 2, 3, 4].map(retryDelay)).toEqual([2, 4, 8, 16, 32]);
    expect(retryDelay(20)).toBe(300);
  });
});

describe("createRetrier", () => {
  it("tries again after growing pauses until everything is sent", async () => {
    const c = clock();
    let left = 3;
    let runs = 0;
    const r = createRetrier(
      async () => (runs++, --left <= 0),
      () => true,
      c.timer,
    );
    r.kick();
    await c.advance(0);
    expect(runs).toBe(1);
    expect(c.pending()).toEqual([2000]);
    expect(r.getState().attempt).toBe(1);
    await c.advance(2000);
    expect(runs).toBe(2);
    expect(c.pending()).toEqual([4000]);
    await c.advance(4000);
    expect(runs).toBe(3);
    expect(c.pending()).toEqual([]);
    expect(r.getState()).toEqual({ attempt: 0, nextAt: null });
  });

  it("does not poll while offline, and starts over when kicked", async () => {
    const c = clock();
    let online = false;
    let runs = 0;
    const r = createRetrier(
      async () => (runs++, false),
      () => online,
      c.timer,
    );
    r.kick();
    await c.advance(0);
    expect(c.pending()).toEqual([]); // offline: wait for the online signal
    online = true;
    r.kick();
    await c.advance(0);
    expect(c.pending()).toEqual([2000]);
    r.kick(); // the connection came back again: go now, with the pause reset
    await c.advance(0);
    expect(runs).toBe(3);
    expect(c.pending()).toEqual([2000]);
  });

  it("treats a thrown error as not done, and stops on request", async () => {
    const c = clock();
    const r = createRetrier(
      async () => {
        throw new Error("Failed to fetch");
      },
      () => true,
      c.timer,
    );
    r.kick();
    await c.advance(0);
    expect(c.pending()).toEqual([2000]);
    r.stop();
    expect(c.pending()).toEqual([]);
  });
});
