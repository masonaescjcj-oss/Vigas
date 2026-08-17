/**
 * The old probe pinged google.com, so on a network where Google is blocked the
 * red banner was pinned on while the app worked. That makes the two things worth
 * testing: where we probe, and how sure we are before shouting about it.
 */
import { describe, expect, it } from "vitest";
import {
  FAILURES_BEFORE_OFFLINE,
  countFailure,
  isOffline,
  probeTarget,
} from "../connectivity";

describe("probeTarget", () => {
  it("points at our own backend, not a third party", () => {
    const target = probeTarget("https://abc.supabase.co");
    expect(target).toBe("https://abc.supabase.co/auth/v1/health");
    expect(target).not.toContain("google");
  });

  it("tolerates a trailing slash", () => {
    expect(probeTarget("https://abc.supabase.co/")).toBe("https://abc.supabase.co/auth/v1/health");
  });

  it("returns null when no backend is configured", () => {
    // Rather than probing a nonsense URL and declaring a permanent outage.
    expect(probeTarget(undefined)).toBeNull();
    expect(probeTarget("")).toBeNull();
  });
});

describe("declaring an outage", () => {
  it("does not announce one on a single dropped request", () => {
    expect(isOffline(countFailure(0, false))).toBe(false);
  });

  it("announces one after consecutive failures", () => {
    let failures = 0;
    for (let attempt = 0; attempt < FAILURES_BEFORE_OFFLINE; attempt += 1) {
      failures = countFailure(failures, false);
    }
    expect(isOffline(failures)).toBe(true);
  });

  it("requires the failures to be consecutive", () => {
    // fail, succeed, fail — that is a flaky network, not an outage.
    let failures = countFailure(0, false);
    failures = countFailure(failures, true);
    failures = countFailure(failures, false);
    expect(isOffline(failures)).toBe(false);
  });

  it("clears immediately on the first success", () => {
    expect(countFailure(9, true)).toBe(0);
    expect(isOffline(0)).toBe(false);
  });
});
