import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { AppError } from "./errorHandler.ts";
import { bearerToken, constantTimeEqual } from "./http.ts";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new AppError(500, "SERVER_MISCONFIGURED", `Required server secret ${name} is not configured.`);
  return value;
}

function keyMap(name: "SUPABASE_PUBLISHABLE_KEYS" | "SUPABASE_SECRET_KEYS"): string[] {
  const raw = Deno.env.get(name);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return Object.values(parsed).filter((value): value is string => typeof value === "string" && value.length > 0);
  } catch {
    throw new AppError(500, "SERVER_MISCONFIGURED", `${name} is not valid JSON.`);
  }
}

export function supabaseUrl(): string {
  return requiredEnv("SUPABASE_URL");
}

export function publicApiKey(): string {
  return Deno.env.get("SUPABASE_ANON_KEY")
    ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    ?? keyMap("SUPABASE_PUBLISHABLE_KEYS")[0]
    ?? requiredEnv("SUPABASE_PUBLISHABLE_KEY");
}

export function serviceApiKey(): string {
  // Prefer the legacy JWT service key while Supabase still injects it: the
  // current supabase-js client can then set both apikey and Authorization.
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? Deno.env.get("SUPABASE_SECRET_KEY")
    ?? keyMap("SUPABASE_SECRET_KEYS")[0]
    ?? requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function serviceApiKeys(): string[] {
  return [
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    Deno.env.get("SUPABASE_SECRET_KEY"),
    ...keyMap("SUPABASE_SECRET_KEYS"),
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
}

export function createServiceClient(): SupabaseClient {
  return createClient(supabaseUrl(), serviceApiKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(req: Request): SupabaseClient {
  return createClient(supabaseUrl(), publicApiKey(), {
    global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req: Request): Promise<{ user: User; client: SupabaseClient; token: string }> {
  // LOCAL_DEV_BYPASS: skip JWT validation for local development
  const localBypass = Deno.env.get("LOCAL_DEV_BYPASS") === "true";

  let token: string;
  try {
    token = bearerToken(req);
  } catch (e) {
    if (localBypass) {
      token = "local-dev-bypass";
    } else {
      throw e;
    }
  }

  const client = createUserClient(req);
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    if (localBypass) {
      // Fallback: use admin API to get the first registered user
      const adminClient = createServiceClient();
      const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (listError || !listData.users?.length) {
        throw new AppError(500, "NO_USERS", "Local dev bypass: no users found in the database. Please sign up first.");
      }
      const fallbackUser = listData.users[0];
      console.log(`[LOCAL_DEV] Auth bypassed for user: ${fallbackUser.email} (${fallbackUser.id})`);
      return { user: fallbackUser as User, client: adminClient, token: "local-dev" };
    }
    throw new AppError(401, "UNAUTHORIZED", "The Supabase Auth token is invalid or expired.");
  }
  return { user: data.user, client, token };
}

/**
 * A signed-in user who is also an operator.
 *
 * `is_admin` is read from the database with the service client, never from the
 * JWT: a claim in a token is whatever the token says, and the admin panel can
 * change pricing, models and the key pool. The flag is set by hand in SQL —
 * there is deliberately no endpoint that grants it.
 *
 * The 404 is not politeness. An admin-only route that answers 403 tells an
 * attacker the route exists and that they merely lack the flag.
 */
export async function requireAdmin(req: Request): Promise<{ user: User; service: SupabaseClient }> {
  const { user } = await requireUser(req);
  const service = createServiceClient();

  const { data, error } = await service
    .from("profiles").select("is_admin").eq("id", user.id).maybeSingle();

  // The column arrives with a migration. Until it is applied every admin call
  // would fail as a bare 404, which reads as "you are not an admin" and sends
  // the operator looking in the wrong place.
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "PGRST204" || code === "PGRST205" || code === "42703" || code === "42P01") {
      throw new AppError(
        503,
        "ADMIN_NOT_MIGRATED",
        "The admin panel needs a database migration that has not been applied yet (profiles.is_admin).",
      );
    }
    throw new AppError(404, "NOT_FOUND", "Not found.");
  }

  if (!data?.is_admin) throw new AppError(404, "NOT_FOUND", "Not found.");

  return { user, service };
}

export async function requireServiceRole(req: Request): Promise<SupabaseClient> {
  const token = bearerToken(req);
  const keys = serviceApiKeys();
  if (!keys.length) throw new AppError(500, "SERVER_MISCONFIGURED", "A Supabase service/secret key is not configured.");
  const accepted = await Promise.all(keys.map((key) => constantTimeEqual(token, key)));
  if (!accepted.some(Boolean)) {
    throw new AppError(403, "SERVICE_ROLE_REQUIRED", "This endpoint is restricted to the service role.");
  }
  return createServiceClient();
}

export { requiredEnv };
