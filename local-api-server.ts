import { handler as agentRunHandler } from "./supabase/functions/agent-run/index.ts";
import { handler as agentResumeHandler } from "./supabase/functions/agent-resume/index.ts";
import { handler as agentForkHandler } from "./supabase/functions/agent-fork/index.ts";
import { handler as projectsCreateHandler } from "./supabase/functions/projects-create/index.ts";
import { handler as projectsDeleteHandler } from "./supabase/functions/projects-delete/index.ts";
import { handler as projectsListHandler } from "./supabase/functions/projects-list/index.ts";
import { handler as projectsUpdateHandler } from "./supabase/functions/projects-update/index.ts";
import { corsHeaders } from "./supabase/functions/shared/http.ts";

const PORT = 54321;

console.log(`🚀 Local API Server starting on http://localhost:${PORT}`);
console.log(`Make sure to have SUPABASE_ACCESS_TOKEN and other environment variables set.`);

Deno.serve({ port: PORT }, async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const authHeader = req.headers.get("Authorization");

  console.log(`[LocalAPI] ${req.method} ${path} | Auth: ${authHeader ? authHeader.substring(0, 20) + '...' : 'none'}`);

  // Handle CORS preflight for all routes
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    let res: Response | null = null;
    if (path === "/functions/v1/agent-run") {
      res = await agentRunHandler(req);
    } else if (path === "/functions/v1/agent-resume") {
      res = await agentResumeHandler(req);
    } else if (path === "/functions/v1/agent-fork") {
      res = await agentForkHandler(req);
    } else if (path === "/functions/v1/projects-create") {
      res = await projectsCreateHandler(req);
    } else if (path === "/functions/v1/projects-delete") {
      res = await projectsDeleteHandler(req);
    } else if (path === "/functions/v1/projects-list") {
      res = await projectsListHandler(req);
    } else if (path === "/functions/v1/projects-update") {
      res = await projectsUpdateHandler(req);
    }

    // ── Direct DB query endpoints (bypass RLS using service client) ──
    const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)\/tasks$/);
    const singleSessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
    const projectSessionsMatch = path.match(/^\/api\/project-sessions\/([^/]+)$/);

    if (!res && sessionMatch && req.method === "GET") {
      const { createServiceClient } = await import("./supabase/functions/shared/supabase.ts");
      const service = createServiceClient();
      const { data, error } = await service.from("agent_tasks")
        .select("*")
        .eq("session_id", sessionMatch[1])
        .order("created_at", { ascending: true });
      if (error) {
        res = new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      } else {
        res = new Response(JSON.stringify(data || []), { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      }
    }

    if (!res && singleSessionMatch && req.method === "GET") {
      const { createServiceClient } = await import("./supabase/functions/shared/supabase.ts");
      const service = createServiceClient();
      const { data, error } = await service.from("agent_sessions")
        .select("*")
        .eq("id", singleSessionMatch[1])
        .single();
      if (error) {
        res = new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      } else {
        res = new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      }
    }

    if (!res && projectSessionsMatch && req.method === "GET") {
      const { createServiceClient } = await import("./supabase/functions/shared/supabase.ts");
      const service = createServiceClient();
      const { data, error } = await service.from("agent_sessions")
        .select("*")
        .eq("project_id", projectSessionsMatch[1])
        .order("updated_at", { ascending: false });
      if (error) {
        res = new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      } else {
        res = new Response(JSON.stringify(data || []), { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      }
    }
    
    if (res) {
      console.log(`[LocalAPI] Response ${res.status}`);
      // also log error if status is not 200/202
      if (!res.ok) {
        const text = await res.clone().text();
        console.log(`[LocalAPI] Error response body: ${text}`);
      }
      return res;
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders(req) });
  } catch (error: any) {
    console.error("[LocalAPI Error]:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" }
    });
  }
});
