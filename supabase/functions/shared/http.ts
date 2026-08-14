import { AppError } from "./errorHandler.ts";

export function corsHeaders(req: Request): Record<string, string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const origin = req.headers.get("origin");
  const allowOrigin = configured.length === 0
    ? "*"
    : origin && configured.includes(origin)
      ? origin
      : configured[0];
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response(null, { status: 204, headers: corsHeaders(req) }) : null;
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function bearerToken(req: Request): string {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AppError(401, "UNAUTHORIZED", "A valid Authorization bearer token is required.");
  return match[1].trim();
}

export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const l = new Uint8Array(left);
  const r = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < l.length; i += 1) diff |= l[i] ^ r[i];
  return diff === 0;
}

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-real-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}
