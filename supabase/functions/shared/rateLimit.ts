import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "./errorHandler.ts";

async function hashKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceRateLimit(
  service: SupabaseClient,
  endpoint: string,
  identity: string,
  limit: number,
  windowSeconds = 60,
): Promise<void> {
  const { data, error } = await service.rpc("consume_edge_rate_limit", {
    p_endpoint: endpoint,
    p_rate_key: await hashKey(identity),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new AppError(500, "RATE_LIMIT_ERROR", "The request rate could not be checked.");
  if (data !== true) {
    throw new AppError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.", {
      retry_after_seconds: windowSeconds,
    });
  }
}
