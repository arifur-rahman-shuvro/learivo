import { describe, expect, it } from "vitest";
import {
  clock,
  cleanActive,
  duration,
  elapsedMs,
  finishPhase,
  nextSession,
  pause,
  progress,
  remainingMs,
  reset,
  restart,
  resume,
  skipBreak,
  start,
  stop,
  type FocusRecord,
  type TimerPlan,
} from "./engine.ts";
import { browserStore, FocusController, RECOVERY_GAP_MS, type KeyValue } from "./controller.ts";
import { MemoryFocus } from "../data/memoryFocus.ts";
import { cleanSettings, DEFAULT_PLAN } from "./settings.ts";
import {
  activeDays,
  bestHour,
  byDay,
  byMonth,
  byWeek,
  distribution,
  heatmap,
  milestones,
  totals,
  weekStart,
} from "./stats.ts";

const MIN = 60_000;
const T0 = new Date(2026, 10, 26, 9, 0, 0).getTime(); // Thu 26 Nov 2026, 09:00 local
const plan: TimerPlan = { ...DEFAULT_PLAN, focusMin: 25, shortMin: 5, longMin: 15, cycles: 2 };
let n = 0;
const id = () => `id-${String(++n).padStart(8, "0")}`;

describe("engine: time comes from timestamps", () => {
  it("counts down from the start time, not from ticks", () => {
    const t = start(plan, T0, id());
    expect(remainingMs(t, T0)).toBe(25 * MIN);
    // One call an hour later, as after a sleeping phone, still gives the right answer.
    expect(elapsedMs(t, T0 + 10 * MIN)).toBe(10 * MIN);
    expect(remainingMs(t, T0 + 10 * MIN)).toBe(15 * MIN);
  });

  it("pause stops the clock and resume continues from where it was", () => {
    let t = start(plan, T0, id());
    t = pause(t, T0 + 10 * MIN);
    expect(elapsedMs(t, T0 + 99 * MIN)).toBe(10 * MIN); // paused for ages: no change
    t = resume(t, T0 + 40 * MIN);
    expect(elapsedMs(t, T0 + 45 * MIN)).toBe(15 * MIN);
    expect(remainingMs(t, T0 + 45 * MIN)).toBe(10 * MIN);
  });

  it("pause and resume twice add up", () => {
    let t = start(plan, T0, id());
    t = pause(t, T0 + 3 * MIN);
    t = resume(t, T0 + 10 * MIN);
    t = pause(t, T0 + 14 * MIN);
    expect(elapsedMs(t, T0 + 500 * MIN)).toBe(7 * MIN);
  });

  it("a clock that jumps backwards never subtracts", () => {
    const t = start(plan, T0, id());
    expect(elapsedMs(t, T0 - 5 * MIN)).toBe(0);
    const p = pause(t, T0 - 5 * MIN);
    expect(p.carriedMs).toBe(0);
  });

  it("never runs past its end", () => {
    const t = start(plan, T0, id());
    expect(elapsedMs(t, T0 + 400 * MIN)).toBe(25 * MIN);
    expect(progress(t, T0 + 400 * MIN)).toBe(1);
  });

  it("reset goes to zero paused, restart goes to zero running", () => {
    let t = start(plan, T0, id());
    t = reset(t, T0 + 5 * MIN, id());
    expect(t.runningSince).toBeNull();
    expect(elapsedMs(t, T0 + 50 * MIN)).toBe(0);
    t = restart(t, T0 + 6 * MIN, id());
    expect(elapsedMs(t, T0 + 8 * MIN)).toBe(2 * MIN);
  });

  it("a stopwatch counts up and has no end", () => {
    const t = start({ ...plan, mode: "stopwatch" }, T0, id());
    expect(remainingMs(t, T0 + 99 * MIN)).toBeNull();
    expect(elapsedMs(t, T0 + 99 * MIN)).toBe(99 * MIN);
  });
});

describe("engine: sessions and breaks", () => {
  it("a finished focus is a completed record, then a short break starts by itself", () => {
    const t = start(plan, T0, "session-one");
    const s = finishPhase(t, T0 + 25 * MIN, id());
    expect(s.record).toMatchObject({
      id: "session-one",
      status: "completed",
      focusSeconds: 1500,
      plannedSeconds: 1500,
      kind: "pomodoro",
    });
    expect(s.next?.phase).toBe("short");
    expect(s.next?.runningSince).not.toBeNull();
  });

  it("every Nth focus is followed by the long break", () => {
    let t = start(plan, T0, id());
    let s = finishPhase(t, T0 + 25 * MIN, id());
    expect(s.next?.phase).toBe("short");
    t = s.next!;
    s = finishPhase(t, T0 + 30 * MIN, id());
    expect(s.record).toBeNull(); // a break is never a record
    expect(s.next?.phase).toBe("focus");
    s = finishPhase({ ...s.next!, runningSince: T0 + 30 * MIN }, T0 + 55 * MIN, id());
    expect(s.next?.phase).toBe("long");
  });

  it("auto-start off: the break waits for a tap", () => {
    const t = start({ ...plan, autoBreak: false }, T0, id());
    expect(finishPhase(t, T0 + 25 * MIN, id()).next?.runningSince).toBeNull();
  });

  it("closing the app past the end still records the real end time", () => {
    const t = start(plan, T0, "late");
    const s = finishPhase(t, T0 + 300 * MIN, id());
    expect(s.record?.focusSeconds).toBe(1500);
    expect(s.record?.endedAt).toBe(new Date(T0 + 25 * MIN).toISOString());
  });

  it("stopping early counts only focus that ran, paused time excluded", () => {
    let t = start(plan, T0, "early");
    t = pause(t, T0 + 10 * MIN);
    t = resume(t, T0 + 30 * MIN);
    const r = stop(t, T0 + 35 * MIN)!;
    expect(r.focusSeconds).toBe(15 * 60);
    expect(r.status).toBe("interrupted");
  });

  it("under a minute is cancelled", () => {
    const t = start(plan, T0, id());
    expect(stop(t, T0 + 59_000)?.status).toBe("cancelled");
    expect(stop(t, T0 + 60_000)?.status).toBe("interrupted");
  });

  it("a stopwatch that is finished on purpose is completed", () => {
    const t = start({ ...plan, mode: "stopwatch" }, T0, id());
    const r = stop(t, T0 + 20 * MIN)!;
    expect(r).toMatchObject({ status: "completed", plannedSeconds: null, focusSeconds: 1200 });
  });

  it("a countdown ends the run when it reaches zero", () => {
    const t = start({ ...plan, mode: "countdown", focusMin: 10 }, T0, id());
    const s = finishPhase(t, T0 + 10 * MIN, id());
    expect(s.record?.status).toBe("completed");
    expect(s.next).toBeNull();
  });

  it("a break is never a record, even when stopped", () => {
    const b = finishPhase(start(plan, T0, id()), T0 + 25 * MIN, id()).next!;
    expect(stop(b, T0 + 27 * MIN)).toBeNull();
  });

  it("skip break gives a paused focus; next session saves what was done", () => {
    const b = finishPhase(start(plan, T0, id()), T0 + 25 * MIN, id()).next!;
    const f = skipBreak(b, T0 + 26 * MIN, id());
    expect(f.phase).toBe("focus");
    expect(f.runningSince).toBeNull();
    const s = nextSession(start(plan, T0, "skip"), T0 + 12 * MIN, id());
    expect(s.record).toMatchObject({ id: "skip", status: "interrupted", focusSeconds: 720 });
    expect(s.next?.phase).toBe("short");
    expect(s.next?.runningSince).toBeNull();
  });

  it("the record keeps the student's calendar day of the start", () => {
    const late = new Date(2026, 10, 26, 23, 50).getTime();
    const r = stop(start(plan, late, id()), late + 20 * MIN)!;
    expect(r.localDay).toBe("2026-11-26");
  });
});

describe("engine: display and cleaning", () => {
  it("formats the clock", () => {
    expect(clock(25 * MIN)).toBe("25:00");
    expect(clock(3_725_000)).toBe("1:02:05");
    expect(clock(500, "up")).toBe("00:01");
    expect(clock(-5)).toBe("00:00");
    expect(duration(30)).toBe("30 s");
    expect(duration(1500)).toBe("25 min");
    expect(duration(3900)).toBe("1h 05m");
  });
  it("refuses a damaged stored timer", () => {
    const good = start(plan, T0, "abcdefgh");
    expect(cleanActive(JSON.parse(JSON.stringify(good)))).toEqual(good);
    expect(cleanActive({ ...good, carriedMs: -1 })).toBeNull();
    expect(cleanActive({ ...good, phase: "nap" })).toBeNull();
    expect(cleanActive({ ...good, plan: { mode: "x" } })).toBeNull();
    expect(cleanActive("text")).toBeNull();
    expect(cleanActive({ ...good, runningSince: "now" })).toBeNull();
  });
  it("cleans settings and clamps values", () => {
    const s = cleanSettings({
      plan: { mode: "pomodoro", focusMin: 9999, shortMin: -4, cycles: 0 },
      presets: [
        { id: "p123", name: "  Night  ", plan: { mode: "custom", focusMin: 40 } },
        { id: "p123", name: "dup", plan: { mode: "custom" } },
        { name: "x" },
      ],
      display: "weird",
    });
    expect(s.plan.focusMin).toBe(600);
    expect(s.plan.shortMin).toBe(1);
    expect(s.plan.cycles).toBe(1);
    expect(s.presets).toHaveLength(1);
    expect(s.presets[0]!.name).toBe("Night");
    expect(s.display).toBe("ring");
    expect(cleanSettings(null).plan).toEqual(DEFAULT_PLAN);
  });
});

const rec = (over: Partial<FocusRecord> & { at: Date }): FocusRecord => {
  const { at, ...rest } = over;
  return {
    id: id(),
    kind: "pomodoro",
    status: "completed",
    startedAt: at.toISOString(),
    endedAt: new Date(at.getTime() + 1500_000).toISOString(),
    focusSeconds: 1500,
    plannedSeconds: 1500,
    localDay: "x",
    ...rest,
  };
};
const today = new Date(2026, 10, 26, 15, 0); // Thursday

describe("study time statistics", () => {
  const records = [
    rec({ at: new Date(2026, 10, 26, 8, 0) }), // today, 25 min
    rec({ at: new Date(2026, 10, 26, 9, 0), status: "interrupted", focusSeconds: 600 }), // today, 10 min
    rec({ at: new Date(2026, 10, 26, 10, 0), status: "cancelled", focusSeconds: 30 }), // never counted
    rec({ at: new Date(2026, 10, 23, 20, 0) }), // Mon of this week
    rec({ at: new Date(2026, 10, 22, 20, 0) }), // Sunday: last week, same month
    rec({ at: new Date(2026, 9, 30, 20, 0) }), // last month
  ];
  it("totals today, week, month, all time", () => {
    const t = totals(records, today);
    expect(t.today).toBe(2100);
    expect(t.week).toBe(2100 + 1500);
    expect(t.month).toBe(2100 + 1500 + 1500);
    expect(t.total).toBe(2100 + 1500 * 3);
    expect(t.sessions).toBe(5);
    expect(t.completedToday).toBe(1);
    expect(t.average).toBe(Math.round(t.total / 5));
  });
  it("cancelled sessions never count as study time", () => {
    expect(totals([rec({ at: today, status: "cancelled", focusSeconds: 50 })], today).total).toBe(
      0,
    );
  });
  it("week starts on Monday", () => {
    expect(weekStart("2026-11-26")).toBe("2026-11-23");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
  });
  it("daily, weekly and monthly series cover quiet days with zero", () => {
    const d = byDay(records, today, 7);
    expect(d).toHaveLength(7);
    expect(d[6]).toEqual({ key: "2026-11-26", seconds: 2100 });
    expect(d[5]!.seconds).toBe(0);
    const w = byWeek(records, today, 3);
    expect(w.map((b) => b.key)).toEqual(["2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(w[2]!.seconds).toBe(3600);
    expect(w[1]!.seconds).toBe(1500);
    const m = byMonth(records, today, 2);
    expect(m.map((b) => b.key)).toEqual(["2026-10-01", "2026-11-01"]);
    expect(m[0]!.seconds).toBe(1500);
  });
  it("distribution, best hour and active days", () => {
    expect(distribution(records).morning).toBe(2100);
    expect(distribution(records).evening).toBe(4500 - 0);
    expect(bestHour(records.slice(0, 2))).toBeNull(); // too little data to say
    expect(bestHour(records)).toBe(20);
    expect(activeDays(records, today, 7)).toBe(3);
  });
  it("heatmap is weeks by Monday-first days, future days empty", () => {
    const h = heatmap(records, today, 2);
    expect(h).toHaveLength(2);
    expect(h[1]![0]!.day).toBe("2026-11-23");
    expect(h[1]![3]!.day).toBe("2026-11-26");
    expect(h[1]![3]!.level).toBe(4); // busiest day
    expect(h[1]![4]!.seconds).toBe(0);
    expect(
      heatmap([], today, 2)
        .flat()
        .every((c) => c.level === 0),
    ).toBe(true);
  });
  it("milestones", () => {
    expect(milestones(0)).toMatchObject({ reached: null, next: 1 });
    expect(milestones(11 * 3600)).toMatchObject({ reached: 10, next: 25 });
    expect(milestones(2000 * 3600).next).toBeNull();
  });
});

function fakeStore(): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
}

function make(store = fakeStore(), repo = new MemoryFocus(), clock = { t: T0 }) {
  let i = 0;
  const c = new FocusController({
    userId: "u1",
    repo,
    store,
    now: () => clock.t,
    newId: () => `ctl-${String(++i).padStart(8, "0")}`,
  });
  return { c, store, repo, clock };
}

describe("controller: reliability", () => {
  it("recovers a running timer after a refresh, with the right time", () => {
    const a = make();
    a.c.begin(plan);
    a.clock.t = T0 + 5 * MIN;
    a.c.heartbeat();
    a.clock.t = T0 + 6 * MIN; // refresh a minute later
    const b = make(a.store, a.repo, a.clock);
    expect(b.c.getState().active?.id).toBe(a.c.getState().active?.id);
    expect(elapsedMs(b.c.getState().active!, a.clock.t)).toBe(6 * MIN);
    expect(b.c.getState().recovery).toBeNull();
  });

  it("recovers a paused timer unchanged", () => {
    const a = make();
    a.c.begin(plan);
    a.clock.t = T0 + 4 * MIN;
    a.c.pause();
    a.clock.t = T0 + 300 * MIN;
    const b = make(a.store, a.repo, a.clock);
    expect(elapsedMs(b.c.getState().active!, a.clock.t)).toBe(4 * MIN);
    expect(b.c.getState().recovery).toBeNull();
  });

  it("asks before trusting a timer after a long absence, and can stop at the last seen time", async () => {
    const a = make();
    a.c.begin(plan);
    a.clock.t = T0 + 3 * MIN;
    a.c.heartbeat();
    a.clock.t = T0 + 3 * MIN + RECOVERY_GAP_MS + 1000;
    const b = make(a.store, a.repo, a.clock);
    expect(b.c.getState().recovery?.seenAt).toBe(T0 + 3 * MIN);
    b.c.stopAtLastSeen();
    await b.c.flush();
    const saved = [...b.repo.rows.values()];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ status: "interrupted", focusSeconds: 180 });
    expect(b.c.getState().active).toBeNull();
  });

  it("keep running continues the original time", () => {
    const a = make();
    a.c.begin(plan);
    a.clock.t = T0 + 5 * MIN;
    a.c.heartbeat();
    a.clock.t = T0 + 15 * MIN;
    const b = make(a.store, a.repo, a.clock);
    expect(b.c.getState().recovery).not.toBeNull();
    b.c.keepRunning();
    expect(b.c.getState().recovery).toBeNull();
    expect(elapsedMs(b.c.getState().active!, a.clock.t)).toBe(15 * MIN);
  });

  it("a session that ended while the app was closed is saved on return, once", async () => {
    const a = make();
    a.c.begin(plan);
    a.clock.t = T0 + 90 * MIN;
    const b = make(a.store, a.repo, a.clock);
    await b.c.flush();
    expect(b.repo.rows.size).toBe(1);
    expect([...b.repo.rows.values()][0]!.focusSeconds).toBe(1500);
    // Opening it again (second device or tab) cannot add another.
    const c2 = make(a.store, a.repo, a.clock);
    await c2.c.flush();
    expect(c2.repo.rows.size).toBe(1);
  });

  it("tick finishes a phase by itself and announces it", async () => {
    const a = make();
    a.c.begin(plan);
    a.clock.t = T0 + 24 * MIN;
    a.c.tick();
    expect(a.c.getState().active?.phase).toBe("focus");
    a.clock.t = T0 + 25 * MIN + 1;
    a.c.tick();
    a.c.tick(); // a second tick must not finish it again
    await a.c.flush();
    expect(a.repo.rows.size).toBe(1);
    expect(a.c.getState().active?.phase).toBe("short");
    expect(a.c.getState().ended).toMatchObject({ n: 1, phase: "focus" });
  });

  it("a failed save waits in the queue and is sent later without duplicates", async () => {
    const a = make();
    a.repo.offline = true;
    a.c.begin(plan);
    a.clock.t = T0 + 10 * MIN;
    a.c.end();
    await a.c.flush();
    expect(a.c.getState().waiting).toBe(1);
    expect(a.c.getState().records).toHaveLength(1); // still shown in the history
    // Reload while still offline: the waiting session survives.
    const b = make(a.store, a.repo, a.clock);
    expect(b.c.getState().waiting).toBe(1);
    a.repo.offline = false;
    await b.c.flush();
    await b.c.flush();
    expect(b.repo.rows.size).toBe(1);
    expect(b.c.getState().waiting).toBe(0);
    expect(b.c.getState().records).toHaveLength(1);
  });

  it("two devices finishing the same session still make one record", async () => {
    const repo = new MemoryFocus();
    const a = make(fakeStore(), repo);
    a.c.begin(plan);
    const stored = a.store.get("learivo.focus.active.u1")!;
    const other = fakeStore();
    other.set("learivo.focus.active.u1", stored);
    const b = make(other, repo, a.clock);
    a.clock.t = T0 + 10 * MIN;
    a.c.end();
    b.c.end();
    await a.c.flush();
    await b.c.flush();
    expect(repo.rows.size).toBe(1);
  });

  it("cannot start a second timer over a running one", () => {
    const a = make();
    a.c.begin(plan);
    const first = a.c.getState().active!.id;
    a.c.begin({ ...plan, mode: "stopwatch" });
    expect(a.c.getState().active!.id).toBe(first);
  });

  it("ignores a corrupt stored timer", () => {
    const store = fakeStore();
    store.set("learivo.focus.active.u1", "{not json");
    store.set("learivo.focus.outbox.u1", "oops");
    expect(make(store).c.getState().active).toBeNull();
  });

  it("each user has their own stored timer", () => {
    const store = fakeStore();
    const a = make(store);
    a.c.begin(plan);
    const other = new FocusController({
      userId: "u2",
      repo: new MemoryFocus(),
      store,
      now: () => T0,
      newId: () => "other-id-1",
    });
    expect(other.getState().active).toBeNull();
  });

  it("deleting a session removes it from the history", async () => {
    const a = make();
    a.c.begin(plan);
    a.clock.t = T0 + 10 * MIN;
    a.c.end();
    await a.c.flush();
    const rid = a.c.getState().records[0]!.id;
    await a.c.removeRecord(rid);
    expect(a.c.getState().records).toHaveLength(0);
    expect(a.repo.rows.size).toBe(0);
  });

  it("settings are cleaned, cached and saved", async () => {
    const a = make();
    await a.c.saveSettings({ ...a.c.getState().settings, plan: { ...plan, focusMin: 40 } });
    expect(a.repo.stored?.plan.focusMin).toBe(40);
    const b = make(a.store, a.repo, a.clock);
    expect(b.c.getState().settings.plan.focusMin).toBe(40);
  });

  it("browserStore never throws", () => {
    const s = browserStore();
    expect(() => s.set("k", "v")).not.toThrow();
    expect(s.get("k")).toBe("v");
    s.remove("k");
  });
});
