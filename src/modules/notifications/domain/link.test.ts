import { describe, expect, it } from "vitest";
import { landingFor, parseNotifyHash } from "./link.ts";

const ID = "0a1b2c3d-1111-2222-3333-444455556666";

describe("notification links", () => {
  it("reads the go value and the message id", () => {
    expect(parseNotifyHash(`#/notify?go=weak%3ARenal%20physiology&n=${ID}`)).toEqual({
      go: "weak:Renal physiology",
      id: ID,
    });
    expect(parseNotifyHash("#/notify")).toEqual({ go: "quick", id: null });
  });
  it("ignores other addresses and a malformed id", () => {
    expect(parseNotifyHash("#/practice")).toBeNull();
    expect(parseNotifyHash("")).toBeNull();
    expect(parseNotifyHash("#/notify?go=quick&n=../../x")?.id).toBeNull();
  });
  it("opens the right place for each kind", () => {
    expect(landingFor("revision")).toEqual({ route: "#/review", intent: null });
    expect(landingFor("insights")).toEqual({ route: "#/insights", intent: null });
    expect(landingFor("weak:Renal")).toEqual({
      route: "#/practice",
      intent: { kind: "start", plan: "weak", subject: "Renal" },
    });
    expect(landingFor("quick")).toEqual({
      route: "#/practice",
      intent: { kind: "start", plan: "quick" },
    });
  });
  it("falls back to a quick session for anything unknown", () => {
    expect(landingFor("nonsense").intent).toEqual({ kind: "start", plan: "quick" });
    expect(landingFor("weak:").intent).toEqual({ kind: "start", plan: "quick" });
  });
});
