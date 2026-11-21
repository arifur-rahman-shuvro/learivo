import { describe, expect, it } from "vitest";
import { emailChangeMessage, readLink } from "./supabaseClient.ts";

describe("readLink", () => {
  it("recognises the emailed reset link and an expired one", () => {
    expect(readLink("#access_token=a&refresh_token=b&type=recovery", "")).toEqual({
      recovery: true,
      expired: false,
      failed: false,
    });
    expect(
      readLink("#error=access_denied&error_code=otp_expired&error_description=expired", ""),
    ).toEqual({ recovery: false, expired: true, failed: false });
  });

  it("notices a Google sign-in that came back without signing in", () => {
    expect(
      readLink("#error=access_denied&error_code=bad_oauth_callback&error_description=denied", ""),
    ).toEqual({ recovery: false, expired: false, failed: true });
  });

  it("ignores ordinary addresses and screen names", () => {
    expect(readLink("", "")).toEqual({ recovery: false, expired: false, failed: false });
    expect(readLink("#/questions", "")).toEqual({ recovery: false, expired: false, failed: false });
    expect(readLink("#/practice", "?x=1")).toEqual({
      recovery: false,
      expired: false,
      failed: false,
    });
  });
});

describe("emailChangeMessage", () => {
  it("gives plain wording and never says who owns an address", () => {
    expect(emailChangeMessage("A user with this email address has already been registered")).toBe(
      "That email cannot be used. Try a different address.",
    );
    expect(emailChangeMessage("Unable to validate email address: invalid format")).toBe(
      "Enter a valid email address.",
    );
    expect(emailChangeMessage("email rate limit exceeded")).toBe(
      "Too many requests. Wait a few minutes and try again.",
    );
  });
});
