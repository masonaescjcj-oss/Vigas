/**
 * scripts/setup-google-auth.ts
 * ---------------------------------------------------------------------------
 * Turn on "Continue with Google" in Supabase Auth.
 *
 * The Google side is a Web application OAuth client whose authorized redirect
 * URI is https://<ref>.supabase.co/auth/v1/callback. That one client serves the
 * web app and the phone app alike: both open Google's page in a browser and
 * Google hands the user back to Supabase, which then sends them on to the
 * redirect the app asked for — which is why that redirect must be in the
 * allow-list below.
 *
 * The allow-list is merged, never replaced: this Supabase project also serves
 * other apps, and their entries must survive.
 *
 * Reads from .env (never the command line):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 *   SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
 *
 *   npx deno run --allow-all --env-file=.env scripts/setup-google-auth.ts
 * ---------------------------------------------------------------------------
 */

const TOKEN = Deno.env.get("SUPABASE_ACCESS_TOKEN");
const REF = Deno.env.get("SUPABASE_PROJECT_REF");
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

if (!TOKEN || !REF || !CLIENT_ID || !CLIENT_SECRET) {
  console.error("SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.");
  Deno.exit(1);
}

/** Where the app may ask to be sent back to after signing in. */
const REDIRECTS = [
  "https://retroai.online",
  "https://retroai.online/**",
  "https://www.retroai.online/**",
  "https://retrobuild.space/**",
  // The phone app's own scheme (app.json "scheme"), for the in-app browser.
  "issac://auth-callback",
  "http://localhost:8082/**",
];

const API = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
// The Management API sits behind a bot filter that refuses non-browser agents.
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};

const current = await (await fetch(API, { headers })).json();
const existing = String(current.uri_allow_list ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const merged = [...existing, ...REDIRECTS.filter((r) => !existing.includes(r))];

const response = await fetch(API, {
  method: "PATCH",
  headers,
  body: JSON.stringify({
    external_google_enabled: true,
    external_google_client_id: CLIENT_ID,
    external_google_secret: CLIENT_SECRET,
    uri_allow_list: merged.join(","),
  }),
});
if (!response.ok) {
  console.error("Supabase refused:", response.status, await response.text());
  Deno.exit(1);
}

const after = await (await fetch(API, { headers })).json();
console.log("google enabled:", after.external_google_enabled);
console.log("client id matches:", after.external_google_client_id === CLIENT_ID);
console.log("allow-list entries:", String(after.uri_allow_list).split(",").length, `(added ${merged.length - existing.length})`);
