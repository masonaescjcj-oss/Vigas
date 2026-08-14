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
    const message =
      data?.message ?? data?.error ?? (raw || res.statusText || `HTTP ${res.status}`);
    throw new FunctionsError(res.status, data?.code, String(message));
  }
  return data as T;
}
