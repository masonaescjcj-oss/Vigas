/**
 * The error path is the one users see when something is wrong, so it gets the
 * coverage. A validation failure must name the field, or the only diagnosis
 * available is bisecting the request body by hand.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// functionsClient reads the access token from the auth store, which would
// otherwise construct a real Supabase client at module load — one that starts
// a refresh timer and reaches for `window`. The token is all this needs.
vi.mock("../../stores/authStore", () => ({
  useAuthStore: { getState: () => ({ session: { access_token: "test-token" } }) },
}));

const invoke = async (status: number, body: unknown) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  }));
  const { invokeFunction } = await import("../functionsClient");
  return invokeFunction("agent-run", { body: {} });
};

describe("invokeFunction error reporting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("names the offending field on a validation failure", async () => {
    await expect(
      invoke(400, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          details: [{ path: "model", message: "Unrecognized key" }],
        },
      }),
    ).rejects.toThrow(/model: Unrecognized key/);
  });

  it("keeps the original message alongside the detail", async () => {
    await expect(
      invoke(400, {
        error: { message: "Request validation failed.", details: [{ path: "prompt", message: "Required" }] },
      }),
    ).rejects.toThrow(/Request validation failed\./);
  });

  it("lists several bad fields but does not run on forever", async () => {
    const details = ["a", "b", "c", "d", "e"].map((path) => ({ path, message: "bad" }));
    await expect(invoke(400, { error: { message: "nope", details } })).rejects.toThrow(
      /a: bad; b: bad; c: bad\)/,
    );
  });

  it("reads a flat {code,message} body too", async () => {
    await expect(invoke(409, { code: "AGENT_BUSY", message: "Already running." })).rejects.toThrow(
      "Already running.",
    );
  });

  it("adds nothing when there are no details", async () => {
    await expect(invoke(404, { error: { message: "Session was not found." } })).rejects.toThrow(
      /^Session was not found\.$/,
    );
  });

  it("falls back to the raw body when it is not JSON", async () => {
    await expect(invoke(502, "upstream exploded")).rejects.toThrow("upstream exploded");
  });

  it("returns the parsed payload on success", async () => {
    await expect(invoke(200, { accepted: true })).resolves.toEqual({ accepted: true });
  });
});

/**
 * A phone app's most ordinary session is: open it, background it, come back an
 * hour later, tap something. That used to produce "the token is invalid or
 * expired" with no recovery. The risk in fixing it is retrying too much, so
 * these pin down exactly which failures earn a second attempt.
 */
describe("shouldRetryAfterRefresh", () => {
  it("retries an expired token", async () => {
    const { shouldRetryAfterRefresh } = await import("../functionsClient");
    expect(shouldRetryAfterRefresh(401, "UNAUTHORIZED", true)).toBe(true);
  });

  it("retries a bare 401, since a gateway may not use our error envelope", async () => {
    const { shouldRetryAfterRefresh } = await import("../functionsClient");
    expect(shouldRetryAfterRefresh(401, undefined, true)).toBe(true);
  });

  it("does not retry when no token was sent", async () => {
    // Refreshing nothing yields nothing; the second call would fail identically.
    const { shouldRetryAfterRefresh } = await import("../functionsClient");
    expect(shouldRetryAfterRefresh(401, "UNAUTHORIZED", false)).toBe(false);
  });

  it("does not retry a decision the server made deliberately", async () => {
    // A fresh token does not change an admin check or a missing row.
    const { shouldRetryAfterRefresh } = await import("../functionsClient");
    expect(shouldRetryAfterRefresh(403, "SERVICE_ROLE_REQUIRED", true)).toBe(false);
    expect(shouldRetryAfterRefresh(404, "NOT_FOUND", true)).toBe(false);
    expect(shouldRetryAfterRefresh(400, "VALIDATION_ERROR", true)).toBe(false);
    expect(shouldRetryAfterRefresh(503, "SHARING_NOT_MIGRATED", true)).toBe(false);
    expect(shouldRetryAfterRefresh(500, undefined, true)).toBe(false);
  });

  it("does not retry a 401 that names some other cause", async () => {
    // Something we have not thought about should surface, not be papered over.
    const { shouldRetryAfterRefresh } = await import("../functionsClient");
    expect(shouldRetryAfterRefresh(401, "PROVIDER_REJECTED", true)).toBe(false);
  });
});

describe("invokeFunction when the backend cannot be reached", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("names the endpoint instead of leaving 'Failed to fetch'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { invokeFunction } = await import("../functionsClient");
    await expect(invokeFunction("agent-ask", { body: {} })).rejects.toThrow(
      /Could not reach "agent-ask" at .+not be deployed/s,
    );
  });
});
