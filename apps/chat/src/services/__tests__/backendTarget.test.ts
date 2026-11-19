/**
 * The one mistake this must prevent: a service role key pasted where the anon key
 * belongs. The anon key ships inside the published page by design; a service role
 * key there is full database access handed to anyone who opens it.
 */
import { describe, expect, it } from "vitest";
import { backendContextFor, classifySupabaseKey, isSupabaseUrl } from "../backendTarget";

/** Builds a legacy JWT-shaped key with the given role, as Supabase issues. */
function legacyKey(role: string): string {
  const body = btoa(JSON.stringify({ iss: "supabase", role, iat: 1 })).replace(/=+$/, "");
  return `eyJhbGciOiJIUzI1NiJ9.${body}.signature`;
}

describe("isSupabaseUrl", () => {
  it("accepts a project URL as the dashboard shows it", () => {
    expect(isSupabaseUrl("https://abcdefgh.supabase.co")).toBe(true);
    expect(isSupabaseUrl("https://abcdefgh.supabase.co/")).toBe(true);
  });

  it("accepts a self-hosted project, since that is legitimate", () => {
    expect(isSupabaseUrl("https://db.example.com")).toBe(true);
  });

  it("rejects http, which would send the key in clear", () => {
    expect(isSupabaseUrl("http://abcdefgh.supabase.co")).toBe(false);
  });

  it("rejects a URL with a path, which means the wrong thing was pasted", () => {
    // People paste the dashboard URL or an endpoint rather than the project URL.
    expect(isSupabaseUrl("https://abcdefgh.supabase.co/rest/v1")).toBe(false);
    expect(isSupabaseUrl("https://supabase.com/dashboard/project/abcdefgh")).toBe(false);
  });

  it("rejects nonsense", () => {
    expect(isSupabaseUrl("")).toBe(false);
    expect(isSupabaseUrl("abcdefgh.supabase.co")).toBe(false);
    expect(isSupabaseUrl("not a url")).toBe(false);
  });
});

describe("classifySupabaseKey", () => {
  it("recognises the new publishable key", () => {
    expect(classifySupabaseKey("sb_publishable_abc123def456")).toBe("anon");
  });

  it("recognises the new secret key, which must never be accepted", () => {
    expect(classifySupabaseKey("sb_secret_abc123def456")).toBe("service_role");
  });

  it("reads the role out of a legacy JWT key", () => {
    expect(classifySupabaseKey(legacyKey("anon"))).toBe("anon");
    expect(classifySupabaseKey(legacyKey("service_role"))).toBe("service_role");
  });

  it("does not guess when it cannot tell", () => {
    // Better to say "unknown" and let the UI warn than to wave a secret through.
    expect(classifySupabaseKey("")).toBe("unknown");
    expect(classifySupabaseKey("some-random-string")).toBe("unknown");
    expect(classifySupabaseKey("a.b.c")).toBe("unknown");
  });

  it("survives a JWT with an unparseable payload", () => {
    expect(() => classifySupabaseKey("eyJ.!!!not-base64!!!.sig")).not.toThrow();
    expect(classifySupabaseKey("eyJ.!!!not-base64!!!.sig")).toBe("unknown");
  });
});

describe("backendContextFor", () => {
  const target = { url: "https://abcdefgh.supabase.co", anonKey: "sb_publishable_x" };

  it("adds nothing when no project is connected", () => {
    // Every request would otherwise pay for an empty header.
    expect(backendContextFor(null)).toBe("");
  });

  it("passes the URL and key to the model", () => {
    const context = backendContextFor(target);
    expect(context).toContain("https://abcdefgh.supabase.co");
    expect(context).toContain("sb_publishable_x");
  });

  it("insists on Row Level Security, which is what actually protects the data", () => {
    const context = backendContextFor(target).replace(/\s+/g, " ");
    expect(context).toMatch(/Row Level Security/i);
    expect(context).toMatch(/auth\.uid\(\)/);
    // And says the key is not access control, which is the belief that leaks data.
    expect(context).toMatch(/not access control/i);
  });

  it("tells the agent to hand the user the SQL rather than assume it exists", () => {
    expect(backendContextFor(target).replace(/\s+/g, " ")).toMatch(/write that SQL out/i);
  });
});
