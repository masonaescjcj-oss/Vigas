/**
 * scripts/check-netlify.ts
 * ---------------------------------------------------------------------------
 * The deploy goes from the app straight to api.netlify.com, which only works
 * because Netlify answers browser origins. That is a fact about someone else's
 * service, so it is measured rather than assumed — if it ever stops being true the
 * feature breaks silently for every web user and nothing in our tests would notice.
 *
 * Also checks that a rejected token produces the message we show. No real token is
 * needed and nothing is deployed: a deliberately invalid one is used, so this is
 * safe to run any time.
 *
 * With NETLIFY_TOKEN set it goes further and performs a real deploy of a tiny site,
 * then deletes it.
 *
 *   npx deno run --allow-all scripts/check-netlify.ts
 * ---------------------------------------------------------------------------
 */
import { readDeployResponse, siteNameFor } from "../src/services/netlify.ts";
import { createZip } from "../supabase/functions/shared/zipStore.ts";

const API = "https://api.netlify.com/api/v1";

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(detail).slice(0, 300)}`}`);
  if (!ok) Deno.exitCode = 1;
}

// ── The browser can reach it at all.
const preflight = await fetch(`${API}/sites`, {
  method: "OPTIONS",
  headers: {
    Origin: "http://localhost:8082",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization,content-type",
  },
});
const allowOrigin = preflight.headers.get("access-control-allow-origin");
const allowMethods = preflight.headers.get("access-control-allow-methods") ?? "";
check(`the preflight succeeds (${preflight.status})`, preflight.ok, preflight.status);
check(`any origin is allowed (${allowOrigin}) — the whole design rests on this`, allowOrigin === "*", allowOrigin);
check(`POST is allowed (${allowMethods})`, /POST/i.test(allowMethods), allowMethods);

// ── A real POST with a deliberately invalid token: proves CORS applies to the
//    actual request, not only the preflight, and that our message is right.
const zip = await createZip([{ path: "index.html", data: new TextEncoder().encode("<h1>probe</h1>") }]);
const rejected = await fetch(`${API}/sites?name=${siteNameFor("probe")}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/zip",
    Authorization: "Bearer not-a-real-token-000000000000",
    // Required for the assertion below to mean anything: a server sends no Origin,
    // and CORS headers are only echoed when one is present. The first version of
    // this script omitted it and concluded Netlify had dropped CORS on the real
    // request — the request was simply not browser-like.
    Origin: "http://localhost:8082",
  },
  body: zip,
});
const rejectedBody = await rejected.text();
let parsed: unknown = null;
try { parsed = rejectedBody ? JSON.parse(rejectedBody) : null; } catch { /* handled below */ }

check(`an invalid token is refused (${rejected.status})`, rejected.status === 401, rejectedBody.slice(0, 200));
check(
  `the real POST also carries CORS (${rejected.headers.get("access-control-allow-origin")})`,
  rejected.headers.get("access-control-allow-origin") === "*",
  "without this, deploying from the web app is blocked by the browser",
);
const message = readDeployResponse(rejected.status, parsed);
check("our reading of it tells the user to replace the token",
  !message.ok && /new personal access token/i.test(message.error ?? ""), message);

// ── The real thing, only when a token is supplied.
const token = Deno.env.get("NETLIFY_TOKEN");
if (!token) {
  console.log("\nSKIP  a real deploy (set NETLIFY_TOKEN to run it; nothing was published)");
  Deno.exit(Deno.exitCode ?? 0);
}

const name = siteNameFor("retro-code-check");
const real = await fetch(`${API}/sites?name=${name}`, {
  method: "POST",
  headers: { "Content-Type": "application/zip", Authorization: `Bearer ${token}` },
  body: await createZip([{
    path: "index.html",
    data: new TextEncoder().encode("<!doctype html><h1>Retro Code deploy check</h1>"),
  }]),
});
const realBody = await real.json().catch(() => null);
const result = readDeployResponse(real.status, realBody);
check(`a real deploy succeeds (${real.status})`, result.ok, result.error ?? realBody);

if (result.ok && result.url) {
  console.log(`      live at ${result.url}`);
  // Netlify needs a moment to propagate; try a few times before judging.
  let served = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const page = await fetch(result.url, { redirect: "follow" }).catch(() => null);
    if (page?.ok) {
      const html = await page.text();
      served = /Retro Code deploy check/.test(html) ? 200 : page.status;
      if (served === 200) break;
    }
  }
  check("the published URL really serves the page", served === 200, `last saw ${served}`);

  // Clean up: this was a probe, not a site anyone asked for.
  const siteId = (realBody as { id?: string })?.id;
  if (siteId) {
    const deleted = await fetch(`${API}/sites/${siteId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    check(`the probe site was deleted afterwards (${deleted.status})`, deleted.ok || deleted.status === 204);
  }
}
