import { handler as agentRunHandler } from "./supabase/functions/agent-run/index.ts";
import { handler as agentResumeHandler } from "./supabase/functions/agent-resume/index.ts";
import { handler as agentForkHandler } from "./supabase/functions/agent-fork/index.ts";
import { handler as projectsCreateHandler } from "./supabase/functions/projects-create/index.ts";
import { handler as projectsDeleteHandler } from "./supabase/functions/projects-delete/index.ts";
import { handler as projectsListHandler } from "./supabase/functions/projects-list/index.ts";
import { handler as projectsUpdateHandler } from "./supabase/functions/projects-update/index.ts";
import { handler as projectFilesHandler } from "./supabase/functions/project-files/index.ts";
import { handler as userDeleteHandler } from "./supabase/functions/user-delete/index.ts";
import { handler as usageCheckHandler } from "./supabase/functions/usage-check/index.ts";
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
    } else if (path === "/functions/v1/project-files") {
      res = await projectFilesHandler(req);
    } else if (path === "/functions/v1/usage-check") {
      res = await usageCheckHandler(req);
    } else if (path === "/functions/v1/user-delete") {
      res = await userDeleteHandler(req);
    }

    // ── Direct DB query endpoints (bypass RLS using service client) ──
    const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)\/tasks$/);
    const singleSessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
    const projectSessionsMatch = path.match(/^\/api\/project-sessions\/([^/]+)$/);
    const projectBundleMatch = path.match(/^\/api\/projects\/([^/]+)\/bundle$/);

    // Text-file bundle of a project's Storage prefix — feeds the on-device preview.
    if (!res && projectBundleMatch && req.method === "GET") {
      const { createServiceClient } = await import("./supabase/functions/shared/supabase.ts");
      const { listStorageFiles, downloadBlob, PROJECT_FILES_BUCKET } = await import("./supabase/functions/shared/storage.ts");
      const service = createServiceClient();
      const { data: project, error } = await service.from("projects").select("sandbox_path").eq("id", projectBundleMatch[1]).maybeSingle();
      if (error || !project) {
        res = new Response(JSON.stringify({ error: error?.message ?? "Project not found" }), { status: error ? 500 : 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      } else {
        const prefix = String(project.sandbox_path).replace(/^\/+|\/+$/g, "");
        const paths = await listStorageFiles(service, PROJECT_FILES_BUCKET, prefix);
        const files: Record<string, string> = {};
        for (const fullPath of paths) {
          const rel = fullPath.slice(prefix.length + 1);
          if (!rel || rel === ".keep") continue;
          if (!/\.(html?|css|js|mjs|json|txt|md|svg)$/i.test(rel)) continue;
          const blob = await downloadBlob(service, PROJECT_FILES_BUCKET, fullPath);
          if (blob.size > 512_000) continue; // skip oversized files
          files[rel] = await blob.text();
        }
        res = new Response(JSON.stringify({ files }), { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
      }
    }

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
