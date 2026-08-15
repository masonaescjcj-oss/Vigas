/**
 * frontend/src/services/functionsClient.ts
 * ---------------------------------------------------------------------------
 * Single fetch wrapper for calling Edge Functions. The base URL comes from
 * EXPO_PUBLIC_API_URL so the same build works against the local Deno gateway
 * (http://localhost:54321/functions/v1) and the deployed Supabase project.
 * ---------------------------------------------------------------------------
 */

import { useAuthStore } from "../stores/authStore";

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://qnrsiukutehcqjhmpuze.supabase.co";

const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const FUNCTIONS_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? `${SUPABASE_URL}/functions/v1`
).replace(/\/+$/, "");

/** Origin of the API host, e.g. http://localhost:54321 — used for the local
 * dev server's extra /api/* endpoints. */
export const API_ORIGIN = FUNCTIONS_URL.replace(/\/functions\/v1$/, "");

export const IS_LOCAL_API =
  FUNCTIONS_URL.includes("localhost") || FUNCTIONS_URL.includes("127.0.0.1");

export class FunctionsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "FunctionsError";
  }
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * A validation failure carries the offending fields in `details`, but the
 * message alone is the generic "Request validation failed." — which sends you
 * bisecting the request body by hand. This folds the field names into the
 * message the UI shows.
 *
 * It matters most when the app is newer than the deployed functions: the
 * schemas are strict, so a field the server has never heard of is rejected
 * wholesale, and "unrecognized key 'model'" is the entire diagnosis.
 */
function describeDetails(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const parts = details
    .map((issue) => {
      if (!issue || typeof issue !== "object") return null;
      const { path, message } = issue as { path?: unknown; message?: unknown };
      const where = typeof path === "string" && path ? path : null;
      const what = typeof message === "string" ? message : null;
      if (where && what) return `${where}: ${what}`;
      return what ?? where;
    })
    .filter((part): part is string => !!part);
  // Three is enough to identify the problem without turning into a wall.
  return parts.length ? parts.slice(0, 3).join("; ") : null;
}

export async function invokeFunction<T>(
  name: string,
  options: { method?: HttpMethod; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? "POST";
  const token = useAuthStore.getState().session?.access_token;

  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(ANON_KEY ? { apikey: ANON_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(options.body ?? {}) }),
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // non-JSON error body — fall through with the raw text
  }

  if (!res.ok) {
    // Edge functions return two shapes: flat {code,message} and nested
    // {error:{code,message}}. Pick the string out of either — otherwise the UI
    // renders "[object Object]".
    const nested = data?.error && typeof data.error === "object" ? data.error : undefined;
    const message =
      data?.message ??
      nested?.message ??
      (typeof data?.error === "string" ? data.error : undefined) ??
      (raw || res.statusText || `HTTP ${res.status}`);
    const detail = describeDetails(data?.details ?? nested?.details);
    throw new FunctionsError(
      res.status,
      data?.code ?? nested?.code,
      detail ? `${message} (${detail})` : String(message),
    );
  }
  return data as T;
}
