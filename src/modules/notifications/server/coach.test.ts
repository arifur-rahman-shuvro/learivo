// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COMEBACK_DAYS,
  decide,
  effectiveCap,
  parseLocal,
  tokensFor,
  type Facts,
} from "../../../../supabase/functions/push/coach.ts";
import { BANK, VOICES, compose, type Kind } from "../../../../supabase/functions/push/messages.ts";

const base: Facts = {
  userId: "u1",
  localNow: "2026-11-25T18:10:00", // a Wednesday
  tone: "mix",
  studyTime: "18:00:00",
  quietStart: "22:00:00",
  quietEnd: "07:00:00",
  kinds: {},
  maxPerDay: 2,
  snoozeUntil: null,
  displayName: "Rahim Uddin",
  dailyGoal: 20,
  answeredToday: 0,
  streak: 0,
  daysAway: 1,
  dueCards: 0,
  examDate: null,
  examTitle: "",
  weakSubject: null,
  weakPercent: null,
  weekAnswered: 0,
  weekPercent: null,
  prevWeekPercent: null,
  sentToday: 0,
  sentKindsToday: [],
  lastSentAt: null,
  ignoredInARow: 0,
  totalAnswers: 100,
};
const now = new Date("2026-11-25T12:10:00Z");
const f = (over: Partial<Facts>): Facts => ({ ...base, ...over });
const kind = (over: Partial<Facts>) => decide(f(over), now)?.kind ?? null;

describe("when the Coach stays quiet", () => {
  it("has nothing to say to someone who has never used the app", () => {
    expect(kind({ totalAnswers: 0, streak: 0 })).toBeNull();
  });
  it("is silent in quiet hours, including the part after midnight", () => {
    expect(kind({ localNow: "2026-11-25T22:30:00", streak: 5 })).toBeNull();
    expect(kind({ localNow: "2026-11-25T03:00:00", studyTime: "03:00:00" })).toBeNull();
    expect(kind({ localNow: "2026-11-25T06:59:00", studyTime: "06:30:00" })).toBeNull();
  });
  it("respects a snooze, and speaks again when it ends", () => {
    expect(kind({ snoozeUntil: "2026-11-25T13:00:00Z" })).toBeNull();
    expect(kind({ snoozeUntil: "2026-11-25T11:00:00Z" })).toBe("daily");
  });
  it("respects the daily cap and the gap since the last message", () => {
    expect(kind({ sentToday: 2 })).toBeNull();
    expect(kind({ sentToday: 1, lastSentAt: "2026-11-25T10:30:00Z" })).toBeNull(); // 1h40 ago
    expect(kind({ sentToday: 1, lastSentAt: "2026-11-25T08:30:00Z" })).toBe("daily");
  });
  it("sends nothing outside the study window and nothing once the goal is done", () => {
    expect(kind({ localNow: "2026-11-25T17:59:00" })).toBeNull();
    expect(kind({ localNow: "2026-11-25T21:01:00" })).toBeNull();
    expect(kind({ answeredToday: 20 })).toBeNull();
  });
  it("only sends one study message a day", () => {
    expect(kind({ sentKindsToday: ["daily"], sentToday: 1 })).toBeNull();
  });
  it("slows down when messages are ignored, and pauses after ten", () => {
    expect(effectiveCap(f({ ignoredInARow: 4 }))).toBe(2);
    expect(effectiveCap(f({ ignoredInARow: 5, maxPerDay: 3 }))).toBe(1);
    expect(effectiveCap(f({ ignoredInARow: 5, maxPerDay: 1 }))).toBe(1);
    expect(kind({ ignoredInARow: 10 })).toBeNull();
    expect(kind({ ignoredInARow: 5, sentToday: 1, lastSentAt: "2026-11-25T08:00:00Z" })).toBeNull();
  });
  it("does not send a kind the student switched off", () => {
    expect(kind({ kinds: { daily: false } })).toBeNull();
  });
});

describe("what the Coach sends", () => {
  it("nudges at the study time while the goal is open", () => {
    const d = decide(base, now)!;
    expect(d.kind).toBe("daily");
    expect(d.go).toBe("quick");
    expect(d.buttons.map((b) => b.action)).toEqual(["start", "later"]);
    expect(d.title + d.body).toContain("20 question");
  });
  it("asks for revision when 8 or more cards are due", () => {
    expect(kind({ dueCards: 8 })).toBe("revision");
    expect(kind({ dueCards: 7 })).toBe("daily");
    expect(decide(f({ dueCards: 9 }), now)!.go).toBe("revision");
  });
  it("offers the weak-spot challenge on alternate days, only for a weak subject", () => {
    const weak = { weakSubject: "Renal", weakPercent: 54 };
    const days = ["2026-11-25T18:10:00", "2026-11-26T18:10:00"].map((localNow) =>
      kind({ ...weak, localNow }),
    );
    expect(days.sort()).toEqual(["daily", "weak"]);
    expect(kind({ weakSubject: "Renal", weakPercent: 80 })).toBe("daily");
    const d = ["2026-11-25T18:10:00", "2026-11-26T18:10:00"]
      .map((localNow) => decide(f({ ...weak, localNow }), now)!)
      .find((x) => x.kind === "weak")!;
    expect(d.go).toBe("weak:Renal");
    expect(d.title + d.body).toContain("Renal");
  });
  it("guards a streak in the evening, only after a real streak and with nothing answered", () => {
    const evening = {
      localNow: "2026-11-25T20:30:00",
      sentKindsToday: ["daily"],
      sentToday: 1,
      lastSentAt: "2026-11-25T08:00:00Z",
    };
    expect(kind({ ...evening, streak: 6 })).toBe("streak");
    expect(kind({ ...evening, streak: 1 })).toBeNull();
    expect(kind({ ...evening, streak: 6, answeredToday: 1 })).toBeNull();
    expect(kind({ ...evening, streak: 6, localNow: "2026-11-25T21:45:00" })).toBeNull(); // too close to quiet hours
    expect(
      decide(f({ ...evening, streak: 6 }), now)!.title +
        decide(f({ ...evening, streak: 6 }), now)!.body,
    ).toContain("6");
  });
  it("counts down to the exam on milestone days only, with the weakest subject", () => {
    const exam = {
      examDate: "2026-12-02",
      examTitle: "Final",
      weakSubject: "Renal",
      weakPercent: 54,
    };
    expect(kind({ ...exam, localNow: "2026-11-25T18:10:00" })).toBe("exam"); // 7 days
    expect(kind({ ...exam, localNow: "2026-11-26T18:10:00" })).not.toBe("exam"); // 6 days
    expect(kind({ ...exam, localNow: "2026-12-01T18:10:00" })).toBe("exam"); // 1 day
    const d = decide(f({ ...exam }), now)!;
    expect(d.go).toBe("weak:Renal");
    expect(d.title + d.body).toMatch(/7 days/);
    expect(d.title + d.body).toContain("Final");
    expect(decide(f({ examDate: "2026-12-02", examTitle: "" }), now)!.go).toBe("quick");
  });
  it("welcomes people back on day 3, 7 and 14 of silence only", () => {
    for (const n of COMEBACK_DAYS) expect(kind({ daysAway: n })).toBe("comeback");
    for (const n of [4, 5, 9, 20]) expect(kind({ daysAway: n })).toBeNull();
  });
  it("sends the weekly summary on Sunday evening only when there was activity", () => {
    const sunday = {
      localNow: "2026-11-29T18:30:00",
      weekAnswered: 84,
      weekPercent: 71,
      prevWeekPercent: 65,
      sentKindsToday: ["daily"],
      sentToday: 1,
      lastSentAt: "2026-11-29T05:00:00Z",
    };
    const d = decide(f(sunday), new Date("2026-11-29T12:30:00Z"))!;
    expect(d.kind).toBe("weekly");
    expect(d.go).toBe("insights");
    expect(d.title + d.body).toMatch(/84 questions/);
    expect(d.title + d.body).toMatch(/up 6 points/);
    expect(decide(f({ ...sunday, weekAnswered: 0 }), now)).toBeNull();
  });
});

describe("the words", () => {
  const sample = tokensFor(
    f({
      examDate: "2026-12-02",
      examTitle: "Final",
      weakSubject: "Renal physiology",
      weakPercent: 54,
      streak: 6,
      dueCards: 9,
      weekAnswered: 84,
      weekPercent: 71,
      prevWeekPercent: 65,
      daysAway: 3,
    }),
    parseLocal(base.localNow),
  );
  const kinds = Object.keys(BANK) as Kind[];

  it("fills every template, with no leftover braces, in every voice", () => {
    for (const k of kinds) {
      for (const v of VOICES) {
        expect(BANK[k][v].length).toBeGreaterThan(0);
        for (let day = 0; day < 6; day++) {
          const w = compose(k, v, sample, "seed", day);
          expect(w.title + w.body).not.toMatch(/[{}]/);
          expect(w.title.length).toBeGreaterThan(3);
        }
      }
    }
  });
  it("keeps titles and bodies short enough for a phone", () => {
    for (const k of kinds)
      for (const v of VOICES)
        for (const w of BANK[k][v]) {
          expect(w.title.length).toBeLessThanOrEqual(60);
          expect(w.body.length).toBeLessThanOrEqual(150);
        }
  });
  it("never uses pressure tricks: fake urgency, threats, shaming or comparison with others", () => {
    const banned =
      /last chance|hurry|only \d+ (minutes|hours)|you will fail|you'll fail|failing|lazy|everyone else|others are|your friends|don't miss out|you must|or else|disappoint|ashamed|worthless|stupid/i;
    for (const k of kinds)
      for (const v of VOICES)
        for (const w of BANK[k][v]) {
          expect(`${w.title} ${w.body}`).not.toMatch(banned);
        }
  });
  it("does not repeat the same words two days in a row, in any voice", () => {
    for (const k of kinds.filter((x) => x !== "test")) {
      for (const v of VOICES) {
        for (let day = 100; day < 110; day++) {
          const a = compose(k, v, sample, "seed", day);
          const b = compose(k, v, sample, "seed", day + 1);
          expect(a.title + a.body).not.toBe(b.title + b.body);
        }
      }
      for (let day = 100; day < 110; day++) {
        expect(
          compose(k, "mix", sample, "seed", day).title +
            compose(k, "mix", sample, "seed", day).body,
        ).not.toBe(
          compose(k, "mix", sample, "seed", day + 1).title +
            compose(k, "mix", sample, "seed", day + 1).body,
        );
      }
    }
  });
  it("mix uses all three voices over time, and a fixed tone keeps its voice", () => {
    const voices = new Set(
      Array.from({ length: 12 }, (_, d) => compose("daily", "mix", sample, "s", d).voice),
    );
    expect(voices.size).toBe(3);
    expect(compose("daily", "funny", sample, "s", 4).voice).toBe("funny");
  });
  it("uses singular and plural correctly, and falls back when a name or exam title is missing", () => {
    const one = tokensFor(
      f({
        dailyGoal: 1,
        answeredToday: 0,
        dueCards: 1,
        displayName: "",
        examTitle: "",
        daysAway: 1,
      }),
      parseLocal(base.localNow),
    );
    expect(one.left).toBe("1 question");
    expect(one.due).toBe("1 card");
    expect(one.name).toBe("there");
    expect(one.exam).toBe("your exam");
    expect(sample.name).not.toBe("there");
    expect(tokensFor(f({ displayName: "Rahim Uddin" }), parseLocal(base.localNow)).name).toBe(
      "Rahim",
    );
  });
});
