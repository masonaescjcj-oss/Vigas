import { describe, it, expect } from "vitest";
import { PolicyEngine } from "../permissions/policyEngine.ts";
import { DEFAULT_RULES } from "../permissions/rules.ts";
import { getProfile } from "../sandbox/profiles.ts";

const ROOT = "/sandbox/project";

function engine(profile: "standard" | "readonly" = "standard", allowlist: string[] = ["example.com"]) {
  return new PolicyEngine({
    profile: getProfile(profile),
    sandboxRoot: ROOT,
    rules: DEFAULT_RULES,
    networkAllowlist: allowlist,
  });
}

describe("PolicyEngine default rules", () => {
  it("ships at least 5 real default rules", () => {
    expect(DEFAULT_RULES.length).toBeGreaterThanOrEqual(5);
    expect(engine().ruleCount).toBeGreaterThanOrEqual(5);
  });

  it("Rule: denies rm -rf", () => {
    const r = engine().evaluate({ toolName: "bash", risk: "exec", input: { command: "rm -rf build" } });
    expect(r.decision).toBe("deny");
    expect(r.ruleId).toBe("bash.destructive");
  });

  it("Rule: denies network to a host off the allowlist", () => {
    const r = engine().evaluate({ toolName: "bash", risk: "exec", input: { command: "curl https://evil.example.net/x" } });
    expect(r.decision).toBe("deny");
    expect(r.ruleId).toBe("bash.network-allowlist");
  });

  it("Rule: allows network to an allow-listed host", () => {
    const r = engine().evaluate({ toolName: "bash", risk: "exec", input: { command: "curl https://api.example.com/v1" } });
    expect(r.decision).toBe("allow");
  });

  it("Rule: denies reading a secret file (.env)", () => {
    const r = engine().evaluate({ toolName: "read", risk: "read", input: { file_path: "config/.env" } });
    expect(r.decision).toBe("deny");
    expect(r.ruleId).toBe("secrets.read");
  });

  it("Rule: denies a file write that escapes the sandbox", () => {
    const r = engine().evaluate({ toolName: "write", risk: "local", input: { file_path: "../../etc/cron.d/x", contents: "x" } });
    expect(r.decision).toBe("deny");
    expect(r.ruleId).toBe("sandbox.path-escape");
  });

  it("Rule: asks before git push (shared state)", () => {
    const r = engine().evaluate({ toolName: "bash", risk: "exec", input: { command: "git push origin main" } });
    expect(r.decision).toBe("ask");
    expect(r.ruleId).toBe("vcs.shared-state");
  });

  it("allows an ordinary in-sandbox write under the standard profile", () => {
    const r = engine().evaluate({ toolName: "write", risk: "local", input: { file_path: "src/app.ts", contents: "ok" } });
    expect(r.decision).toBe("allow");
  });

  it("readonly profile denies any mutating tool", () => {
    const r = engine("readonly").evaluate({ toolName: "write", risk: "local", input: { file_path: "src/app.ts", contents: "ok" } });
    expect(r.decision).toBe("deny");
    expect(r.ruleId).toBe("profile.enforcement");
  });

  it("readonly profile still allows reads", () => {
    const r = engine("readonly").evaluate({ toolName: "read", risk: "read", input: { file_path: "src/app.ts" } });
    expect(r.decision).toBe("allow");
  });

  it("denies apply_patch whose target escapes the sandbox", () => {
    const patch = "*** Begin Patch\n*** Add File: ../../evil.sh\n+echo pwned\n*** End Patch";
    const r = engine().evaluate({ toolName: "apply_patch", risk: "local", input: { patch } });
    expect(r.decision).toBe("deny");
    expect(r.ruleId).toBe("sandbox.path-escape");
  });
});
