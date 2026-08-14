/**
 * sandbox/profiles.ts
 * ---------------------------------------------------------------------------
 * Isolation profiles. A profile declares what a runtime session is allowed to
 * do with the workspace. We ship the two levels our product surfaces (via the
 * "suggest-only" segmented control in the client):
 *
 *   - "standard": full read/write, confined to the project sandbox root.
 *   - "readonly": read-only. Any mutating tool (write, edit, apply_patch, and
 *                 any exec/bash) is denied. Used when the user chose
 *                 "only suggest changes".
 *
 * A profile is intentionally small and declarative; the permission engine and
 * the sandbox filesystem both consult it. It does NOT run external shell
 * scripts or grant ambient system access.
 * ---------------------------------------------------------------------------
 */

import type { ToolRisk } from "../toolRegistry.ts";

export type SandboxProfileName = "standard" | "readonly";

export interface SandboxProfile {
  name: SandboxProfileName;
  /** Human description surfaced in the UI. */
  description: string;
  /** May tools read files? (always true for our profiles) */
  canRead: boolean;
  /** May tools create/modify/delete files inside the sandbox? */
  canWrite: boolean;
  /** May the agent execute shell commands at all? */
  canExecute: boolean;
  /** Risk levels this profile permits; anything else is denied outright. */
  allowedRisks: ToolRisk[];
}

export const STANDARD_PROFILE: SandboxProfile = {
  name: "standard",
  description: "Full read/write access, confined to the project sandbox root.",
  canRead: true,
  canWrite: true,
  canExecute: true,
  allowedRisks: ["read", "local", "exec", "external"],
};

export const READONLY_PROFILE: SandboxProfile = {
  name: "readonly",
  description: "Read-only. The agent can inspect and propose, but not modify files or run commands.",
  canRead: true,
  canWrite: false,
  canExecute: false,
  allowedRisks: ["read"],
};

export const SANDBOX_PROFILES: Record<SandboxProfileName, SandboxProfile> = {
  standard: STANDARD_PROFILE,
  readonly: READONLY_PROFILE,
};

export function getProfile(name: SandboxProfileName): SandboxProfile {
  const p = SANDBOX_PROFILES[name];
  if (!p) throw new Error(`Unknown sandbox profile: ${name}`);
  return p;
}

/** True if a tool of the given risk is permitted under this profile. */
export function profileAllowsRisk(profile: SandboxProfile, risk: ToolRisk): boolean {
  return profile.allowedRisks.includes(risk);
}
