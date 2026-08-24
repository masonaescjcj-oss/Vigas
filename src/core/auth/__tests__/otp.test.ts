/**
 * The rules around a one-time code.
 *
 * The case that matters most is paste: on a phone, people copy the code out of
 * the email — often with words attached — and paste it in. A field that
 * rejects "Your code is 123456" teaches them to retype what they just copied.
 */

import { describe, expect, it } from "vitest";
import {
  describeOtpError,
  formatCooldown,
  isCompleteOtp,
  maskEmail,
  normaliseOtp,
  OTP_LENGTH,
} from "../otp";

describe("reading what the user typed or pasted", () => {
  it("keeps a plain code", () => {
    expect(normaliseOtp("123456")).toBe("123456");
  });

  it("recovers the code from a pasted sentence", () => {
    // What actually lands in the field when someone copies from the email.
    expect(normaliseOtp("Your code is 123456")).toBe("123456");
    expect(normaliseOtp("123 456")).toBe("123456");
    expect(normaliseOtp("123-456")).toBe("123456");
  });

  it("never exceeds the code length", () => {
    expect(normaliseOtp("1234567890")).toBe("123456");
    expect(normaliseOtp("1234567890").length).toBe(OTP_LENGTH);
  });

  it("survives empty and non-string input", () => {
    expect(normaliseOtp("")).toBe("");
    expect(normaliseOtp(undefined as unknown as string)).toBe("");
    expect(normaliseOtp("no digits here")).toBe("");
  });

  it("knows when the code is complete", () => {
    expect(isCompleteOtp("12345")).toBe(false);
    expect(isCompleteOtp("123456")).toBe(true);
    // Complete after cleaning, which is what the submit button should follow.
    expect(isCompleteOtp("12 34 56")).toBe(true);
  });
});

describe("error messages a user can act on", () => {
  it("separates expired from wrong", () => {
    // Supabase says "Token has expired or is invalid" for both, and the two
    // need different actions: get a new code, or retype this one.
    expect(describeOtpError("Token has expired")).toContain("expired");
    expect(describeOtpError("Token has expired")).toContain("Send a new one");
    expect(describeOtpError("Invalid token")).toContain("not right");
  });

  it("names rate limiting as something that passes", () => {
    expect(describeOtpError("Email rate limit exceeded")).toContain("Wait");
    expect(describeOtpError("too many requests")).toContain("Wait");
  });

  it("distinguishes a network failure from a bad code", () => {
    // Telling someone their code is wrong when the phone is offline sends
    // them to request another one, which will also fail.
    expect(describeOtpError("NetworkError: failed to fetch")).toContain("connection");
  });

  it("always returns something usable", () => {
    expect(describeOtpError(undefined)).toBeTruthy();
    expect(describeOtpError(null)).toBeTruthy();
    expect(describeOtpError("something unexpected")).toBeTruthy();
  });
});

describe("the resend countdown", () => {
  it("reads as seconds under a minute", () => {
    expect(formatCooldown(45)).toBe("45s");
    expect(formatCooldown(1)).toBe("1s");
  });

  it("reads as mm:ss above one", () => {
    expect(formatCooldown(60)).toBe("1:00");
    expect(formatCooldown(75)).toBe("1:15");
  });

  it("never shows a negative", () => {
    expect(formatCooldown(0)).toBe("0s");
    expect(formatCooldown(-5)).toBe("0s");
  });
});

describe("masking the address", () => {
  it("leaves it recognisable but not copyable", () => {
    expect(maskEmail("someone@example.com")).toBe("so***e@example.com");
  });

  it("handles a very short name", () => {
    expect(maskEmail("ab@example.com")).toBe("a***@example.com");
    expect(maskEmail("a@example.com")).toBe("a***@example.com");
  });

  it("does not throw on nonsense", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
    expect(maskEmail("")).toBe("");
  });
});
