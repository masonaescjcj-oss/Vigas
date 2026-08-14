import * as Sentry from "@sentry/deno";

let initialized = false;

function env(name: string): string | undefined {
  const deno = (globalThis as typeof globalThis & { Deno?: { env: { get(key: string): string | undefined } } }).Deno;
  return deno?.env.get(name) ?? (typeof process !== "undefined" ? process.env[name] : undefined);
}

export function initSentry(functionName?: string): void {
  if (initialized) return;
  initialized = true;
  const dsn = env("SENTRY_DSN");
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: env("SENTRY_ENVIRONMENT") ?? "production",
    release: env("SENTRY_RELEASE") ?? "issac-backend",
    tracesSampleRate: Number(env("SENTRY_TRACES_SAMPLE_RATE") ?? "0.1"),
    serverName: functionName,
  });
}

export async function flushSentry(timeoutMs = 2_000): Promise<void> {
  if (initialized) await Sentry.flush(timeoutMs).catch(() => false);
}

export function captureException(error: unknown, context?: Record<string, unknown>): string {
  initSentry();
  return Sentry.withScope((scope) => {
    if (context) scope.setContext("request", context);
    return Sentry.captureException(error);
  });
}

export async function withSentrySpan<T>(name: string, op: string, callback: () => Promise<T>): Promise<T> {
  initSentry(name);
  return await Sentry.startSpan({ name, op }, callback);
}

export function withSentryHandler(name: string, handler: (req: Request) => Response | Promise<Response>): (req: Request) => Promise<Response> {
  initSentry(name);
  return async (req) => await withSentrySpan(name, "http.server", async () => {
    try {
      return await handler(req);
    } catch (error) {
      captureException(error, { function: name, method: req.method, url: req.url });
      await flushSentry();
      throw error;
    }
  });
}
