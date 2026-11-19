/**
 * supabase/functions/shared/providerGuard.ts
 * ---------------------------------------------------------------------------
 * Deciding whether a user-supplied API endpoint is safe to call.
 *
 * Users may bring any provider — a curated list would shut out every new
 * entrant, which is the opposite of the point. So this is not a list of
 * approved companies. It rejects URLs that do not describe a public API server
 * at all: plaintext http, raw IP addresses, loopback, private ranges, and the
 * link-local address cloud providers serve instance credentials from.
 *
 * Without this, "call the URL the user gave you" is server-side request
 * forgery: our function would happily fetch http://169.254.169.254/ and hand
 * back whatever it found.
 *
 * What this does NOT stop, stated plainly: a hostname whose DNS resolves to a
 * private address (DNS rebinding). Blocking that needs either an egress proxy
 * or DNS pinning at connect time, and Deno Deploy offers neither. The realistic
 * attack — someone typing an internal address into the field — is covered.
 * ---------------------------------------------------------------------------
 */

export interface UrlVerdict {
  ok: boolean;
  /** Present when ok is false; safe to show the user. */
  reason?: string;
  /** The URL to store: normalised, no trailing slash. */
  normalised?: string;
}

/** Hostnames that never belong to a public API. */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain"];

/** Private, loopback, link-local and carrier-grade NAT ranges. */
function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 10) return true;                       // 10/8
  if (a === 127) return true;                      // loopback
  if (a === 0) return true;                        // "this network"
  if (a === 169 && b === 254) return true;         // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true;         // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function looksLikeIPv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

export function checkProviderUrl(raw: string): UrlVerdict {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "That is not a valid URL." };
  }

  if (url.protocol !== "https:") {
    return {
      ok: false,
      reason: "The endpoint must use https — an API key sent over http is readable in transit.",
    };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "Put the key in the API key field, not in the URL." };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "That address is not reachable as a public API." };
  }

  // An IPv6 literal arrives bracketed; ::1 and the unique-local fc00::/7 block
  // are the same class of target as the IPv4 private ranges.
  if (host.startsWith("[")) {
    return { ok: false, reason: "Use the provider's hostname rather than an IP address." };
  }

  if (looksLikeIPv4(host)) {
    return isPrivateIPv4(host)
      ? { ok: false, reason: "That address is not reachable as a public API." }
      : { ok: false, reason: "Use the provider's hostname rather than an IP address." };
  }

  // A hostname with no dot is a local name (or a search-domain lookup), never
  // a provider on the internet.
  if (!host.includes(".")) {
    return { ok: false, reason: "That does not look like a provider's address." };
  }

  // Strip a trailing slash so "https://x/v1" and "https://x/v1/" are one row.
  const normalised = url.toString().replace(/\/+$/, "");
  return { ok: true, normalised };
}
