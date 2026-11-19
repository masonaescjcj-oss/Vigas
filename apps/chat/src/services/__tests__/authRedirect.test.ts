/**
 * Password reset was completely broken: nothing turned the emailed link into a
 * session, so the one screen that needs one always failed. These cover the three
 * shapes Supabase actually sends, and particularly the refusals — an expired link
 * is the common case, and a person needs to be told to request another one rather
 * than shown a generic failure.
 */
import { describe, expect, it } from "vitest";
import { describeAuthError, parseAuthRedirect } from "../authRedirect";

describe("parseAuthRedirect", () => {
  it("reads the implicit flow's tokens from the fragment", () => {
    const url =
      "issac://reset-password#access_token=aaa&expires_in=3600&refresh_token=bbb" +
      "&token_type=bearer&type=recovery";
    expect(parseAuthRedirect(url)).toEqual({
      kind: "session",
      accessToken: "aaa",
      refreshToken: "bbb",
      type: "recovery",
    });
  });

  it("reads the PKCE flow's code from the query", () => {
    expect(parseAuthRedirect("issac://reset-password?code=xyz123")).toEqual({
      kind: "code",
      code: "xyz123",
    });
  });

  it("reads tokens from a query too, since the flow decides where they go", () => {
    const parsed = parseAuthRedirect("https://app.example/reset?access_token=aaa&refresh_token=bbb");
    expect(parsed).toMatchObject({ kind: "session", accessToken: "aaa" });
  });

  it("prefers the fragment when a URL carries both", () => {
    // The implicit flow puts the real tokens in the fragment; a query copy would
    // be something else's leftovers.
    const parsed = parseAuthRedirect(
      "issac://reset?access_token=query#access_token=fragment&refresh_token=bbb",
    );
    expect(parsed).toMatchObject({ accessToken: "fragment" });
  });

  it("reports an expired link as a refusal, not as a session", () => {
    const url =
      "issac://reset-password#error=access_denied&error_code=otp_expired" +
      "&error_description=Email+link+is+invalid+or+has+expired";
    expect(parseAuthRedirect(url)).toEqual({
      kind: "error",
      code: "otp_expired",
      description: "Email link is invalid or has expired",
    });
  });

  it("reports a refusal even when a stale token rides along", () => {
    // Must not try to use a token from a link the server already rejected.
    const parsed = parseAuthRedirect(
      "issac://reset#error_code=otp_expired&access_token=stale&refresh_token=stale",
    );
    expect(parsed?.kind).toBe("error");
  });

  it("returns null for a URL with nothing auth-related in it", () => {
    expect(parseAuthRedirect("issac://reset-password")).toBeNull();
    expect(parseAuthRedirect("https://app.example/")).toBeNull();
  });

  it("returns null rather than throwing on nothing at all", () => {
    // getInitialURL() is null on a normal cold start.
    expect(parseAuthRedirect(null)).toBeNull();
    expect(parseAuthRedirect(undefined)).toBeNull();
    expect(parseAuthRedirect("")).toBeNull();
  });

  it("does not mistake a half-delivered link for a session", () => {
    // One token alone cannot establish a session, and passing it on would fail
    // deeper in with a worse message.
    expect(parseAuthRedirect("issac://reset#access_token=aaa")).toBeNull();
    expect(parseAuthRedirect("issac://reset#refresh_token=bbb")).toBeNull();
  });
});

describe("describeAuthError", () => {
  it("tells someone with an expired link what to actually do", () => {
    const message = describeAuthError({
      code: "otp_expired",
      description: "Email link is invalid or has expired",
    });
    expect(message).toMatch(/expired/i);
    expect(message).toMatch(/request a new one/i);
  });

  it("recognises expiry from the description when there is no code", () => {
    const message = describeAuthError({ code: null, description: "Token has expired" });
    expect(message).toMatch(/request a new one/i);
  });

  it("explains a reused link", () => {
    const message = describeAuthError({ code: "access_denied", description: "not allowed" });
    expect(message).toMatch(/already been used/i);
  });

  it("passes anything else through rather than inventing a diagnosis", () => {
    expect(describeAuthError({ code: "weird_thing", description: "Something specific" }))
      .toBe("Something specific");
  });
});
