/**
 * The old probe pinged google.com, so on a network where Google is blocked the
 * red banner was pinned on while the app worked. That makes the two things worth
 * testing: where we probe, and how sure we are before shouting about it.
 */
import { describe, expect, it } from "vitest";
import {
  FAILURES_BEFORE_OFFLINE,
  OFFLINE_RECHECK_MS,
  ONLINE_RECHECK_MS,
  countFailure,
  isOffline,
  nextProbeDelay,
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

describe("nextProbeDelay", () => {
  it("chases a single failure to a conclusion, on web too", () => {
    // The bug this exists for: with no timer scheduled, one failed probe left a
    // web client believing it was online forever, and a real outage during which
    // no banner ever appeared.
    expect(nextProbeDelay(1, true)).toBe(OFFLINE_RECHECK_MS);
    expect(nextProbeDelay(1, false)).toBe(OFFLINE_RECHECK_MS);
  });

  it("keeps checking while offline", () => {
    expect(nextProbeDelay(5, true)).toBe(OFFLINE_RECHECK_MS);
  });

  it("needs no timer on a healthy web client", () => {
    // The browser's online/offline events are free and instant.
    expect(nextProbeDelay(0, true)).toBeNull();
  });

  it("polls slowly on a healthy native client, which has no such events", () => {
    expect(nextProbeDelay(0, false)).toBe(ONLINE_RECHECK_MS);
  });
});
