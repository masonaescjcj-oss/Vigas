/**
 * permissions/rules.ts
 * ---------------------------------------------------------------------------
 * The default rule set consulted by the PolicyEngine. Every rule here is real
 * and enforced (proven by permissions tests). Rules abstain (return null) when
 * they do not apply, so they compose cleanly.
 *
 * Precedence is handled by the engine (deny > ask > allow); rules only state
 * their own local opinion.
 * ---------------------------------------------------------------------------
 */

import { isPathAllowed } from "../sandbox/pathGuard.ts";
import type { PermissionRule, ToolCallEvaluation } from "./policyEngine.ts";

/** Filenames / path fragments that hold secrets and must never be read. */
const SECRET_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.[\w.-]+)?$/i, //           .env, .env.local, .env.production
  /(^|\/)\.git-credentials$/i,
  /(^|\/)id_(rsa|ed25519|ecdsa|dsa)$/i, //  private ssh keys
  /(^|\/)\.ssh\//i,
  /(^|\/)\.aws\/credentials$/i,
  /(^|\/)\.npmrc$/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.key$/i,
  /(^|\/)credentials\.json$/i,
  /(^|\/)service-account.*\.json$/i,
];

function looksLikeSecret(p: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(p));
}

/** Extract candidate hostnames from a shell command. */
function extractHosts(command: string): string[] {
  const hosts = new Set<string>();
  // URLs
  const urlRe = /\bhttps?:\/\/([^\s/'"]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(command))) hosts.add(m[1].toLowerCase().replace(/:.*/, ""));
  // bare host after curl/wget without scheme, e.g. `curl example.com/x`
  const bareRe = /\b(?:curl|wget|nc|ncat|scp|ftp|http|https)\s+(?:-[^\s]+\s+)*([a-z0-9.-]+\.[a-z]{2,})\b/gi;
  while ((m = bareRe.exec(command))) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

function hostAllowed(host: string, allowlist: string[]): boolean {
  return allowlist.some((allowed) => {
    const a = allowed.toLowerCase();
    return host === a || host.endsWith(`.${a}`);
  });
}

/** True if the command performs any network fetch we recognize. */
function isNetworkCommand(command: string): boolean {
  return /\b(curl|wget|nc|ncat|scp|sftp|ftp|rsync\s+[^|]*::|npm\s+publish|pip\s+download)\b/i.test(
    command,
  );
}

// ---- Rule 1: enforce the sandbox profile (readonly blocks mutation) --------
export const profileEnforcementRule: PermissionRule = {
  id: "profile.enforcement",
  description: "Deny mutating or executing tools when the active profile forbids them.",
  evaluate(ev) {
    if (!ev.profile.canWrite && (ev.risk === "local" || ev.risk === "external")) {
      return { decision: "deny", reason: `Profile "${ev.profile.name}" is read-only; ${ev.toolName} would modify state.` };
    }
    if (!ev.profile.canExecute && ev.risk === "exec") {
      return { decision: "deny", reason: `Profile "${ev.profile.name}" forbids command execution.` };
    }
    return null;
  },
};

// ---- Rule 2: never let a file operation escape the sandbox root ------------
export const sandboxPathEscapeRule: PermissionRule = {
  id: "sandbox.path-escape",
  description: "Deny any file operation whose target resolves outside the sandbox root.",
  evaluate(ev) {
    for (const p of ev.targetPaths) {
      if (!isPathAllowed(p, { sandboxRoot: ev.sandboxRoot })) {
        return { decision: "deny", reason: `Target path "${p}" is outside the sandbox root.` };
      }
    }
    return null;
  },
};

// ---- Rule 3: block reads of secret files ----------------------------------
export const secretReadRule: PermissionRule = {
  id: "secrets.read",
  description: "Deny reading credential/secret files (.env, private keys, cloud credentials).",
  evaluate(ev) {
    const targets = [...ev.targetPaths];
    // Also catch `cat .env` style reads via bash.
    if (ev.command) {
      const catRe = /\b(?:cat|less|more|head|tail|bat|xxd|od|strings)\s+([^\s;|&]+)/gi;
      let m: RegExpExecArray | null;
      while ((m = catRe.exec(ev.command))) targets.push(m[1]);
    }
    for (const p of targets) {
      if (looksLikeSecret(p)) {
        return { decision: "deny", reason: `Access to secret file "${p}" is blocked.` };
      }
    }
    return null;
  },
};

// ---- Rule 4: block outright-destructive shell commands ---------------------
export const destructiveCommandRule: PermissionRule = {
  id: "bash.destructive",
  description: "Deny irrecoverable shell commands (rm -rf, mkfs, dd to device, fork bomb).",
  evaluate(ev) {
    const c = ev.command;
    if (!c) return null;
    const denyPatterns: Array<[RegExp, string]> = [
      [/\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|-r\s+-f|-f\s+-r)\b/i, "recursive force-remove (rm -rf)"],
      [/\brm\s+-[a-z]*r[a-z]*\s+\/(?:\s|$)/i, "recursive remove of filesystem root"],
      [/\bmkfs(\.[a-z0-9]+)?\b/i, "filesystem format (mkfs)"],
      [/\bdd\b[^\n]*\bof=\/dev\//i, "raw device write (dd of=/dev/...)"],
      [/:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, "fork bomb"],
      [/\bchmod\s+-R\s+0*777\s+\//i, "world-writable recursive chmod of root"],
      [/>\s*\/dev\/sd[a-z]/i, "redirect to raw disk device"],
    ];
    for (const [re, label] of denyPatterns) {
      if (re.test(c)) return { decision: "deny", reason: `Blocked destructive command: ${label}.` };
    }
    return null;
  },
};

// ---- Rule 5: gate network access by allowlist -----------------------------
export const networkAllowlistRule: PermissionRule = {
  id: "bash.network-allowlist",
  description: "Deny shell network access to hosts outside the allowlist.",
  evaluate(ev) {
    const c = ev.command;
    if (!c || !isNetworkCommand(c)) return null;
    const hosts = extractHosts(c);
    if (hosts.length === 0) {
      // A network tool with no resolvable host (e.g. reading from a var) — ask.
      return { decision: "ask", reason: "Network command with an undetermined host; confirm before running." };
    }
    const blocked = hosts.filter((h) => !hostAllowed(h, ev.networkAllowlist));
    if (blocked.length > 0) {
      return { decision: "deny", reason: `Network host(s) not on allowlist: ${blocked.join(", ")}.` };
    }
    return { decision: "allow", reason: `All network hosts are allow-listed: ${hosts.join(", ")}.` };
  },
};

// ---- Rule 6: confirm shared-state / irreversible VCS actions --------------
export const sharedStateRule: PermissionRule = {
  id: "vcs.shared-state",
  description: "Ask before actions others can see or that rewrite shared history.",
  evaluate(ev) {
    const c = ev.command;
    if (!c) return null;
    const askPatterns: Array<[RegExp, string]> = [
      [/\bgit\s+push\b/i, "git push"],
      [/\bgit\s+reset\s+--hard\b/i, "git reset --hard"],
      [/\bgit\s+(commit\s+--amend|rebase)\b/i, "rewriting git history"],
      [/\bgit\s+branch\s+-D\b/i, "force-deleting a branch"],
      [/\bgh\s+(pr|issue|release)\b/i, "GitHub write via gh"],
      [/\bnpm\s+publish\b/i, "publishing a package"],
    ];
    for (const [re, label] of askPatterns) {
      if (re.test(c)) return { decision: "ask", reason: `Confirm before: ${label}.` };
    }
    return null;
  },
};

/** The default, ordered rule set. */
export const DEFAULT_RULES: PermissionRule[] = [
  profileEnforcementRule,
  sandboxPathEscapeRule,
  secretReadRule,
  destructiveCommandRule,
  networkAllowlistRule,
  sharedStateRule,
];
