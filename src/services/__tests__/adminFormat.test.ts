/**
 * The plan editor treats a blank field as "unlimited". Getting that wrong is
 * not cosmetic: a blank read as 0 would lock an entire tier out of building,
 * and a null read as "leave alone" would silently ignore the operator.
 */
import { describe, expect, it } from "vitest";
import { healthLabel, keyHealth, limitLabel, parseLimit } from "../adminFormat";

type PoolKeySummary = {
  id: string; label: string; base_url: string; key_last4: string; model: string | null;
  priority: number; is_active: boolean; last_used_at: string | null; last_ok_at: string | null;
  last_error: string | null; failure_count: number; exhausted_at: string | null; created_at: string;
};

const key = (over: Partial<PoolKeySummary> = {}): PoolKeySummary => ({
  id: "1", label: "k", base_url: "https://x/v1", key_last4: "abcd", model: null,
  priority: 100, is_active: true, last_used_at: null, last_ok_at: null,
  last_error: null, failure_count: 0, exhausted_at: null, created_at: "", ...over,
});

describe("keyHealth", () => {
  it("is working once it has answered", () => {
    expect(keyHealth(key({ last_ok_at: "2026-08-16T00:00:00Z" }))).toBe("working");
  });

  it("is resting while exhausted, even if it worked before", () => {
    expect(keyHealth(key({
      last_ok_at: "2026-08-16T00:00:00Z",
      exhausted_at: "2026-08-16T01:00:00Z",
    }))).toBe("resting");
  });

  it("is off when disabled, whatever else is true", () => {
    expect(keyHealth(key({ is_active: false, last_ok_at: "2026-08-16T00:00:00Z" }))).toBe("off");
  });

  it("is untested when it has never answered", () => {
    expect(keyHealth(key())).toBe("untested");
  });

  it("has a readable label for every state", () => {
    for (const state of ["working", "resting", "off", "untested"] as const) {
      expect(healthLabel(state).length).toBeGreaterThan(0);
    }
  });
});

describe("limits", () => {
  it("shows null as unlimited rather than as a blank or a zero", () => {
    expect(limitLabel(null)).toBe("Unlimited");
    expect(limitLabel(0)).toBe("0");
    expect(limitLabel(1000)).toBe("1,000");
  });

  it("reads a blank field as unlimited, not as zero", () => {
    expect(parseLimit("")).toBe(null);
    expect(parseLimit("   ")).toBe(null);
    expect(parseLimit("unlimited")).toBe(null);
  });

  it("reads a real number, ignoring separators", () => {
    expect(parseLimit("4")).toBe(4);
    expect(parseLimit("1,000")).toBe(1000);
    expect(parseLimit(" 25 ")).toBe(25);
  });

  it("keeps zero, which is a real limit meaning nothing is allowed", () => {
    expect(parseLimit("0")).toBe(0);
  });

  it("refuses nonsense rather than storing NaN", () => {
    expect(parseLimit("lots")).toBe(null);
    expect(parseLimit("-5")).toBe(null);
  });

  it("round-trips a value through the editor", () => {
    for (const value of [null, 0, 4, 100000]) {
      const shown = value === null ? "" : String(value);
      expect(parseLimit(shown)).toBe(value);
    }
  });
});
