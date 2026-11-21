import { describe, expect, it } from "vitest";
import { readLink } from "./supabaseClient.ts";

describe("readLink", () => {
  it("recognises the emailed reset link and an expired one", () => {
    expect(readLink("#access_token=a&refresh_token=b&type=recovery", "")).toEqual({
      recovery: true,
      expired: false,
    });
    expect(
      readLink("#error=access_denied&error_code=otp_expired&error_description=expired", ""),
    ).toEqual({ recovery: false, expired: true });
  });

  it("ignores ordinary addresses and screen names", () => {
    expect(readLink("", "")).toEqual({ recovery: false, expired: false });
    expect(readLink("#/questions", "")).toEqual({ recovery: false, expired: false });
    expect(readLink("#/practice", "?x=1")).toEqual({ recovery: false, expired: false });
  });
});
