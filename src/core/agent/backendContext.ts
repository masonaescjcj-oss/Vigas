/**
 * frontend/src/core/agent/backendContext.ts
 * ---------------------------------------------------------------------------
 * The user's own Supabase project, described to the model.
 *
 * Separate from services/backendTarget.ts on purpose: this half is imported by the
 * edge functions, and that half touches AsyncStorage. Putting them together drags a
 * React Native module into the server's graph — the same mistake that once broke
 * every test in functionsClient.
 *
 * The validators live here too, because both sides need them: the app to refuse a
 * bad paste, the server to refuse a bad request.
 * ---------------------------------------------------------------------------
 */

export interface BackendTarget {
  url: string;
  anonKey: string;
}

/** A Supabase project URL, as the dashboard shows it. */
export function isSupabaseUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!/^https:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    // Self-hosted is legitimate, so the host is not restricted to supabase.co —
    // only the shape is checked. A path means they pasted the wrong thing.
    return parsed.pathname === "" || parsed.pathname === "/";
  } catch {
    return false;
  }
}

/**
 * Distinguish the publishable key from the secret one.
 *
 * This is the point of the whole check. The anon key is meant to be public and
 * ships inside the built page either way. A service role key in that same page is
 * full database access handed to anyone who opens it.
 */
export function classifySupabaseKey(value: string): "anon" | "service_role" | "unknown" {
  const trimmed = value.trim();
  if (!trimmed) return "unknown";

  if (trimmed.startsWith("sb_secret_")) return "service_role";
  if (trimmed.startsWith("sb_publishable_")) return "anon";

  // A legacy key is a JWT whose payload names the role.
  const parts = trimmed.split(".");
  if (parts.length === 3) {
    try {
      const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "=")));
      if (payload?.role === "service_role") return "service_role";
      if (payload?.role === "anon") return "anon";
    } catch {
      return "unknown";
    }
  }
  return "unknown";
}

/**
 * The block handed to the model when the Supabase skill is on.
 *
 * It ends on the Row Level Security instruction rather than opening with it: that
 * is the last thing read before the model starts, and it is the one that decides
 * whether the built app is safe or wide open.
 */
export function backendContextFor(target: BackendTarget | null): string {
  if (!target) return "";
  return [
    "",
    "# The user's Supabase project",
    `URL: ${target.url}`,
    `Anon (publishable) key: ${target.anonKey}`,
    "",
    "Use these in the page you build. The anon key belongs in the page — it is",
    "designed to be public. It is not access control: every table you touch must",
    "have Row Level Security enabled with a policy scoped to auth.uid(). Write that",
    "SQL out for the user and tell them to run it, or the table is readable by",
    "anyone who opens the page.",
  ].join("\n");
}
