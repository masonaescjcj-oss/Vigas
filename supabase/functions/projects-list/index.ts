import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { ProjectCursorSchema, ProjectListSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";

function decodeCursor(value: string): { createdAt: string; id: string } {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
    return ProjectCursorSchema.parse(JSON.parse(atob(normalized)));
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "The pagination cursor is invalid or expired.");
  }
}

function encodeCursor(value: { createdAt: string; id: string }): string {
  return btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["GET"]);
    const { user } = await requireUser(req);
    const url = new URL(req.url);
    const input = ProjectListSchema.parse({ limit: url.searchParams.get("limit") ?? undefined, cursor: url.searchParams.get("cursor") ?? undefined });
    const service = createServiceClient();
    await enforceRateLimit(service, "projects-list", user.id, 120);
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    let query = service.from("projects").select("id,user_id,name,description,sandbox_path,last_opened_at,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(input.limit + 1);
    if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    const hasMore = rows.length > input.limit;
    const projects = hasMore ? rows.slice(0, input.limit) : rows;
    const last = projects.at(-1);
    return json({ projects, next_cursor: hasMore && last ? encodeCursor({ createdAt: String(last.created_at), id: String(last.id) }) : null }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("projects-list", handler));
}
