import { z, ZodError, type ZodType } from "zod";
import { captureException, flushSentry } from "./sentry.ts";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function assertMethod(req: Request, allowed: string[]): void {
  if (!allowed.includes(req.method)) {
    throw new AppError(405, "METHOD_NOT_ALLOWED", `Method ${req.method} is not allowed.`, { allowed });
  }
}

export async function parseJson<T>(req: Request, schema: ZodType<T>, maxBytes = 1_048_576): Promise<T> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBytes} bytes.`);
  }
  let value: unknown;
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBytes} bytes.`);
    }
    value = text.length === 0 ? {} : JSON.parse(text);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "INVALID_JSON", "Request body must contain valid JSON.");
  }
  return schema.parse(value);
}

export function errorResponse(error: unknown, requestId: string, headers: HeadersInit = {}): Response {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected server error occurred.";
  let details: unknown;

  if (error instanceof AppError) {
    ({ status, code, message, details } = error);
  } else if (error && typeof error === "object" && "status" in error && "code" in error && "message" in error) {
    const typed = error as { status: number; code: string; message: string; details?: unknown };
    status = typed.status;
    code = typed.code;
    message = typed.message;
    details = typed.details;
  } else if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Request validation failed.";
    details = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  } else {
    console.error(`[${requestId}]`, error);
  }

  if (status >= 500) {
    captureException(error, { request_id: requestId, error_code: code, http_status: status });
    void flushSentry();
  }

  return new Response(JSON.stringify({ error: { code, message, details, request_id: requestId } }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function asAppError(error: { message?: string; code?: string } | null, operation: string): never {
  throw new AppError(500, "DATABASE_ERROR", `${operation} failed.`, {
    database_code: error?.code ?? "unknown",
  });
}

export const UuidSchema = z.string().uuid();
