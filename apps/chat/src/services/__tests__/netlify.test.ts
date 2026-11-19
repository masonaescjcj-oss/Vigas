/**
 * The deploy call goes from the app straight to Netlify, so the failures a user
 * will actually hit — a stale token, a taken name, a rate limit — have to turn into
 * something they can act on. The response shapes here are Netlify's documented
 * ones; the request itself is exercised against the live API by
 * scripts/check-netlify.ts, which is the only way to know CORS and the endpoint
 * still behave.
 */
import { describe, expect, it } from "vitest";
import { looksLikeNetlifyToken, readDeployResponse, siteNameFor } from "../netlify";

describe("siteNameFor", () => {
  const fixed = () => 0.5;

  it("turns a project name into a valid subdomain", () => {
    const name = siteNameFor("Coffee Finder", fixed);
    expect(name).toMatch(/^[a-z0-9-]+$/);
    expect(name).toContain("coffee-finder");
  });

  it("strips anything a subdomain cannot contain", () => {
    // Netlify accepts only lowercase letters, digits and hyphens.
    expect(siteNameFor("My App! (v2) — final", fixed)).toMatch(/^[a-z0-9-]+$/);
  });

  it("handles a name with no usable characters at all", () => {
    // A Persian project name has no Latin letters to build a subdomain from.
    const name = siteNameFor("سنگک", fixed);
    expect(name).toMatch(/^retro-app-[a-z0-9]+$/);
  });

  it("never leaves a trailing or leading hyphen", () => {
    // Netlify rejects those outright.
    for (const input of ["---", "  spaced  ", "!!!", "a--"]) {
      const name = siteNameFor(input, fixed);
      expect(name.startsWith("-"), input).toBe(false);
      expect(name.endsWith("-"), input).toBe(false);
    }
  });

  it("keeps the name short enough to be a subdomain", () => {
    const name = siteNameFor("a".repeat(200), fixed);
    expect(name.length).toBeLessThanOrEqual(40);
  });

  it("adds a suffix, because the namespace is global", () => {
    // "bakery" was taken years ago; without this every deploy would collide.
    const a = siteNameFor("bakery", () => 0.1);
    const b = siteNameFor("bakery", () => 0.9);
    expect(a).not.toBe(b);
    expect(a.startsWith("bakery-")).toBe(true);
  });
});

describe("looksLikeNetlifyToken", () => {
  it("accepts a plausible token", () => {
    expect(looksLikeNetlifyToken("nfp_" + "a".repeat(40))).toBe(true);
  });

  it("rejects something obviously not a token", () => {
    // Catches the commonest paste mistakes before a pointless round trip.
    expect(looksLikeNetlifyToken("")).toBe(false);
    expect(looksLikeNetlifyToken("short")).toBe(false);
    expect(looksLikeNetlifyToken("my token with spaces in it here")).toBe(false);
  });
});

describe("readDeployResponse", () => {
  it("returns the https address on success", () => {
    const result = readDeployResponse(201, {
      ssl_url: "https://bakery-ab12.netlify.app",
      url: "http://bakery-ab12.netlify.app",
      admin_url: "https://app.netlify.com/sites/bakery-ab12",
      name: "bakery-ab12",
    });
    expect(result.ok).toBe(true);
    // ssl_url over url: never hand someone a plain-http link to their own site.
    expect(result.url).toBe("https://bakery-ab12.netlify.app");
    expect(result.adminUrl).toContain("app.netlify.com");
  });

  it("falls back to url when there is no ssl_url", () => {
    const result = readDeployResponse(200, { url: "http://x.netlify.app" });
    expect(result.ok).toBe(true);
    expect(result.url).toBe("http://x.netlify.app");
  });

  it("does not report success without an address", () => {
    // A "successful" deploy the user cannot open is not a success.
    const result = readDeployResponse(201, { name: "x" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/did not return an address/i);
  });

  it("tells the user to replace a rejected token", () => {
    const result = readDeployResponse(401, { message: "Unauthorized" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/new personal access token/i);
  });

  it("explains a name clash rather than showing a bare 422", () => {
    const result = readDeployResponse(422, { message: "Subdomain must be unique" });
    expect(result.error).toMatch(/Subdomain must be unique/);
  });

  it("says to wait when rate limited", () => {
    expect(readDeployResponse(429, {}).error).toMatch(/wait a few minutes/i);
  });

  it("passes an unexpected status through with whatever Netlify said", () => {
    expect(readDeployResponse(500, { message: "Internal" }).error).toBe("Internal");
    expect(readDeployResponse(503, {}).error).toMatch(/503/);
  });

  it("survives a body that is not an object", () => {
    for (const body of [null, undefined, "text", 42]) {
      expect(() => readDeployResponse(500, body)).not.toThrow();
    }
  });
});
