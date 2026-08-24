/**
 * What analytics is allowed to say.
 *
 * The agent promises never to send the user's repository, history or session
 * state anywhere. These are the tests that stop analytics breaking that promise
 * from the other direction — so the cases that matter are the ones where
 * something should be *dropped*.
 */

import { describe, expect, it } from "vitest";
import { durationBucket, EVENT_SCHEMA, isEventName, sanitizeEvent } from "../events";

describe("event names", () => {
  it("accepts only names in the table", () => {
    expect(isEventName("build_started")).toBe(true);
    expect(isEventName("build_startd")).toBe(false);
    expect(isEventName("")).toBe(false);
    expect(isEventName(undefined)).toBe(false);
  });

  it("drops an unknown event entirely rather than sending it half-formed", () => {
    // A typo becomes silence, not a new column of garbage.
    expect(sanitizeEvent("prompt_submitted", { prompt: "build me a shop" })).toBeNull();
  });

  it("does not treat inherited Object keys as events", () => {
    // hasOwn, not `in` — otherwise "toString" and "constructor" are events.
    expect(isEventName("toString")).toBe(false);
    expect(isEventName("constructor")).toBe(false);
    expect(sanitizeEvent("hasOwnProperty", {})).toBeNull();
  });
});

describe("properties are allow-listed, not deny-listed", () => {
  it("keeps what the event declares", () => {
    expect(sanitizeEvent("build_started", { model: "deepseek-reasoner", skill_count: 2 }))
      .toEqual({
        event: "build_started",
        properties: { model: "deepseek-reasoner", skill_count: 2 },
      });
  });

  it("drops anything the event did not declare", () => {
    // The whole point: a caller cannot attach content by accident or by
    // reaching for a convenient extra field.
    const result = sanitizeEvent("build_started", {
      model: "auto",
      prompt: "make me a banking app for Reza",
      file_path: "src/secrets.ts",
      project_name: "My Startup",
      email: "someone@example.com",
    });
    expect(result).toEqual({ event: "build_started", properties: { model: "auto" } });
  });

  it("drops objects and arrays, which is how content would travel", () => {
    const result = sanitizeEvent("build_finished", {
      outcome: "success",
      // Declared key, but a structure rather than a value.
      tool_count: { nested: "payload" },
      step_count: ["a", "b"],
    });
    expect(result).toEqual({ event: "build_finished", properties: { outcome: "success" } });
  });

  it("truncates a long string instead of shipping it", () => {
    // A long value means a caller passed something it should not have. A
    // clipped marker is easier to spot in the data than a missing key.
    const long = "x".repeat(500);
    const result = sanitizeEvent("build_finished", { outcome: long });
    expect((result!.properties.outcome as string).length).toBe(40);
  });

  it("keeps an event with no properties at all", () => {
    expect(sanitizeEvent("signed_up", { anything: "ignored" }))
      .toEqual({ event: "signed_up", properties: {} });
  });

  it("skips null, undefined and non-finite numbers", () => {
    const result = sanitizeEvent("build_finished", {
      outcome: null,
      duration_bucket: undefined,
      tool_count: NaN,
      step_count: Infinity,
    });
    expect(result).toEqual({ event: "build_finished", properties: {} });
  });

  it("keeps false and zero, which are real answers", () => {
    // A naive truthiness filter would drop both, and "did nobody use their own
    // provider" is exactly the question false answers.
    expect(sanitizeEvent("build_started", { has_own_provider: false, skill_count: 0 }))
      .toEqual({
        event: "build_started",
        properties: { has_own_provider: false, skill_count: 0 },
      });
  });
});

describe("durations are bucketed, never exact", () => {
  it("puts a duration in a band", () => {
    expect(durationBucket(1_200)).toBe("under_5s");
    expect(durationBucket(9_000)).toBe("5_15s");
    expect(durationBucket(45_000)).toBe("30_60s");
    expect(durationBucket(600_000)).toBe("over_3m");
  });

  it("does not pretend nonsense is a duration", () => {
    expect(durationBucket(-1)).toBe("unknown");
    expect(durationBucket(NaN)).toBe("unknown");
    expect(durationBucket(Infinity)).toBe("unknown");
  });
});

describe("the schema itself", () => {
  it("declares no property that reads like user content", () => {
    // A guard on the table rather than on a call site: this is the review that
    // is easy to forget when adding an event six months from now.
    const forbidden = /prompt|content|html|code|file|path|title|name|email|message|text|query/i;
    for (const [event, keys] of Object.entries(EVENT_SCHEMA)) {
      for (const key of keys as readonly string[]) {
        expect(forbidden.test(key), `${event}.${key} reads like user content`).toBe(false);
      }
    }
  });
});
