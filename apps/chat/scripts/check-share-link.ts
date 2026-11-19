/**
 * scripts/check-share-link.ts
 * ---------------------------------------------------------------------------
 * Does a share link open as a page, or as source code?
 *
 * Supabase Edge Functions are widely reported to force text/plain on HTML
 * responses, which would mean every share link shows its own markup to whoever
 * opens it. That belief has been carried around this project as a note rather
 * than a measurement, and a launch blocker deserves better than a note.
 *
 * So this makes a real share of a real project and looks at what a browser
 * would actually receive.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-share-link.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  const email = `share-${stamp}@example.com`;
  const password = `Sh-${crypto.randomUUID()}`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr) throw createErr;
  cleanup.push(() => admin.auth.admin.deleteUser(created.user!.id));

  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  const token = signIn.session!.access_token;

  const call = (name: string, body: unknown) =>
    fetch(`${API_URL}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  const project = await call("projects-create", { name: `Share ${stamp}`, template: "landing" });
  const projectId = (await project.json().catch(() => ({})))?.project?.id;
  if (!projectId) throw new Error("no project id came back.");
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", projectId); });

  // The client builds the preview HTML and shares that, rather than the server
  // rendering the project — so the check has to supply a page the way the app
  // does.
  const page = [
    "<!doctype html><html><head><meta charset=\"utf-8\">",
    `<title>Share ${stamp}</title></head>`,
    `<body><h1>Share ${stamp}</h1><p>Shared from a check.</p></body></html>`,
  ].join("");

  const share = await call("share", {
    action: "create",
    projectId,
    html: page,
    title: `Share ${stamp}`,
  });
  const shareBody = await share.json().catch(() => ({}));
  check(`a share can be created (${share.status})`, share.ok, shareBody);

  const url: string | undefined = shareBody?.url ?? shareBody?.share?.url;
  if (!url) throw new Error(`no url came back: ${JSON.stringify(shareBody).slice(0, 300)}`);
  console.log(`\n      link: ${url}\n`);

  // ── What a browser receives. No auth header: this is a public link.
  const res = await fetch(url, { headers: { accept: "text/html" } });
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();

  console.log(`      HTTP ${res.status}   content-type: ${contentType}`);
  console.log(`      body starts: ${body.slice(0, 60).replace(/\n/g, " ")}\n`);

  check(`the link resolves (${res.status})`, res.ok, body.slice(0, 200));
  check("the body is an HTML document", /^\s*<!doctype html/i.test(body), body.slice(0, 120));

  // The whole question. text/plain means the visitor reads the markup.
  check(
    `the browser is told it is HTML (got "${contentType}")`,
    /text\/html/i.test(contentType),
    "text/plain makes a browser render the markup as text — the page shows its own source",
  );

  check(
    "the shared project's content is in the page",
    body.includes(`Share ${stamp}`) || body.length > 500,
    { length: body.length },
  );
} finally {
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
}
