/**
 * Vercel takes no zip, so this path builds a file list instead. The size guard is
 * the one worth being careful about: a check on string length rather than byte
 * length would let a Persian page through at twice the real size, and the request
 * would fail deep inside Vercel instead of here with an explanation.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_INLINE_BYTES,
  inlineFilesFrom,
  looksLikeVercelToken,
  readVercelResponse,
  totalBytesOf,
  vercelProjectName,
} from "../vercel";

describe("vercelProjectName", () => {
  it("makes a valid project name", () => {
    expect(vercelProjectName("Coffee Finder")).toBe("coffee-finder");
  });

  it("adds no random suffix, unlike Netlify", () => {
    // A Vercel project name is scoped to the account, so redeploying should land on
    // the same project rather than litter it with copies.
    expect(vercelProjectName("bakery")).toBe(vercelProjectName("bakery"));
  });

  it("falls back when there is nothing usable", () => {
    expect(vercelProjectName("سنگک")).toBe("retro-app");
    expect(vercelProjectName("!!!")).toBe("retro-app");
  });

  it("never leaves a leading or trailing hyphen", () => {
    for (const input of ["--x--", "  spaced  ", "a--"]) {
      const name = vercelProjectName(input);
      expect(name.startsWith("-"), input).toBe(false);
      expect(name.endsWith("-"), input).toBe(false);
    }
  });

  it("stays within Vercel's length limit", () => {
    expect(vercelProjectName("a".repeat(300)).length).toBeLessThanOrEqual(100);
  });
});

describe("inlineFilesFrom", () => {
  it("shapes each file the way the API expects", () => {
    expect(inlineFilesFrom({ "index.html": "<h1>hi</h1>" })).toEqual([
      { file: "index.html", data: "<h1>hi</h1>", encoding: "utf-8" },
    ]);
  });

  it("strips a leading slash, which Vercel rejects", () => {
    expect(inlineFilesFrom({ "/index.html": "x" })[0].file).toBe("index.html");
  });

  it("drops .keep, which only exists to hold an empty folder in Storage", () => {
    const files = inlineFilesFrom({ "index.html": "x", ".keep": "", "src/.keep": "" });
    expect(files.map((f) => f.file)).toEqual(["index.html"]);
  });

  it("keeps nested paths as they are", () => {
    expect(inlineFilesFrom({ "assets/css/app.css": "b{}" })[0].file).toBe("assets/css/app.css");
  });
});

describe("totalBytesOf", () => {
  it("counts bytes, not characters", () => {
    // The bug this exists for: a Persian character is two bytes of UTF-8, so a
    // length check would report half the real size.
    const persian = inlineFilesFrom({ "a.txt": "سلام" });
    expect(totalBytesOf(persian)).toBe(8);
    expect(totalBytesOf(persian)).toBeGreaterThan("سلام".length);
  });

  it("sums across files", () => {
    expect(totalBytesOf(inlineFilesFrom({ "a": "12345", "b": "123" }))).toBe(8);
  });
});

describe("readVercelResponse", () => {
  it("adds a scheme, since Vercel returns a bare hostname", () => {
    const result = readVercelResponse(200, { url: "my-app-abc123.vercel.app", name: "my-app" });
    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://my-app-abc123.vercel.app");
  });

  it("leaves a full URL alone", () => {
    expect(readVercelResponse(200, { url: "https://x.vercel.app" }).url).toBe("https://x.vercel.app");
  });

  it("falls back to an alias when there is no url", () => {
    expect(readVercelResponse(200, { alias: ["y.vercel.app"] }).url).toBe("https://y.vercel.app");
  });

  it("does not report success without an address", () => {
    const result = readVercelResponse(201, { name: "x" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/did not return an address/i);
  });

  it("tells the user to replace a rejected token", () => {
    for (const status of [401, 403]) {
      expect(readVercelResponse(status, {}).error).toMatch(/new one and paste it again/i);
    }
  });

  it("surfaces Vercel's own message for a refused request", () => {
    const result = readVercelResponse(400, { error: { message: "Invalid file path" } });
    expect(result.error).toMatch(/Invalid file path/);
  });

  it("says to wait when rate limited", () => {
    expect(readVercelResponse(429, {}).error).toMatch(/wait a few minutes/i);
  });

  it("survives a body that is not an object", () => {
    for (const body of [null, undefined, "text", 42]) {
      expect(() => readVercelResponse(500, body)).not.toThrow();
    }
  });
});

describe("looksLikeVercelToken", () => {
  it("accepts a plausible token and rejects the common mistakes", () => {
    expect(looksLikeVercelToken("a".repeat(24))).toBe(true);
    expect(looksLikeVercelToken("short")).toBe(false);
    expect(looksLikeVercelToken("token with spaces pasted from docs")).toBe(false);
  });
});

describe("the inline limit", () => {
  it("is small enough to be a sane request and large enough for a real page", () => {
    expect(MAX_INLINE_BYTES).toBeGreaterThan(500_000);
    expect(MAX_INLINE_BYTES).toBeLessThan(10_000_000);
  });
});
