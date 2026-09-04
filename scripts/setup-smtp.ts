/**
 * scripts/setup-smtp.ts
 * ---------------------------------------------------------------------------
 * Point Supabase Auth at a real mail provider.
 *
 * Without one, every email the project sends goes through Supabase's shared
 * mailer, which allows two messages an hour for the whole project and then
 * refuses. That is why sign-up confirmation had to be switched off
 * (mailer_autoconfirm), and it is why password reset does not work: unlike
 * confirmation, a reset cannot be skipped — the code has to reach the person.
 *
 * Credentials are read from .env, never passed on the command line, so they do
 * not end up in a shell history:
 *
 *   SMTP_HOST=smtp-relay.brevo.com
 *   SMTP_PORT=587
 *   SMTP_USER=<the SMTP login Brevo shows you>
 *   SMTP_PASS=<the SMTP key — not the account password, not the API key>
 *   MAIL_FROM=noreply@retrobuild.space      # must be a verified sender in Brevo
 *   MAIL_FROM_NAME=Retro Code
 *
 * Usage:
 *   npx deno run --allow-all --env-file=.env scripts/setup-smtp.ts
 *   npx deno run --allow-all --env-file=.env scripts/setup-smtp.ts --require-confirmation
 *   npx deno run --allow-all --env-file=.env scripts/setup-smtp.ts --send-test you@example.com
 *
 * --require-confirmation turns mailer_autoconfirm off, so a new account must
 * enter the emailed code. Do not pass it until a test message has actually
 * arrived — with a broken relay it locks every new user out of sign-up.
 * ---------------------------------------------------------------------------
 */

const ACCESS_TOKEN = Deno.env.get("SUPABASE_ACCESS_TOKEN");
const PROJECT_REF = Deno.env.get("SUPABASE_PROJECT_REF");
const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

const HOST = Deno.env.get("SMTP_HOST");
const PORT = Number(Deno.env.get("SMTP_PORT") ?? 587);
const USER = Deno.env.get("SMTP_USER");
const PASS = Deno.env.get("SMTP_PASS");
const FROM = Deno.env.get("MAIL_FROM");
const FROM_NAME = Deno.env.get("MAIL_FROM_NAME") ?? "Retro Code";

/** How many auth emails an hour the project may send once a real relay is set. */
const RATE_LIMIT_PER_HOUR = 60;

const args = new Set(Deno.args);
const requireConfirmation = args.has("--require-confirmation");
const sendTestTo = Deno.args[Deno.args.indexOf("--send-test") + 1];
const wantsTest = args.has("--send-test");

function die(message: string): never {
  console.error(`\n✗ ${message}\n`);
  Deno.exit(1);
}

if (!ACCESS_TOKEN || !PROJECT_REF) die("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF must be in .env");
const missing = [
  ["SMTP_HOST", HOST], ["SMTP_USER", USER], ["SMTP_PASS", PASS], ["MAIL_FROM", FROM],
].filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  die(
    `Missing in .env: ${missing.join(", ")}\n` +
    `  In Brevo: SMTP & API → SMTP. The "Login" is SMTP_USER and the SMTP key is SMTP_PASS.\n` +
    `  MAIL_FROM must be an address Brevo has verified, or a domain you have authenticated there.`,
  );
}
if (wantsTest && (!sendTestTo || sendTestTo.startsWith("--"))) {
  die("--send-test needs an address: --send-test you@example.com");
}

/** The Management API refuses a request that does not look like a browser. */
const headers = {
  "Authorization": `Bearer ${ACCESS_TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0",
};
const CONFIG_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

async function readConfig(): Promise<Record<string, unknown>> {
  const res = await fetch(CONFIG_URL, { headers });
  if (!res.ok) die(`Could not read the auth config (${res.status}): ${await res.text()}`);
  return await res.json();
}

const before = await readConfig();
console.log("Before:");
console.log(`  smtp_host            ${before.smtp_host ?? "(none — using the shared mailer)"}`);
console.log(`  rate_limit_email_sent ${before.rate_limit_email_sent}/hour`);
console.log(`  mailer_autoconfirm   ${before.mailer_autoconfirm}`);

const patch: Record<string, unknown> = {
  smtp_host: HOST,
  smtp_port: String(PORT),
  smtp_user: USER,
  smtp_pass: PASS,
  smtp_admin_email: FROM,
  smtp_sender_name: FROM_NAME,
  // The shared mailer's two-an-hour cap is a property of the shared mailer.
  // With our own relay the provider's own quota is the real limit.
  rate_limit_email_sent: RATE_LIMIT_PER_HOUR,
};
if (requireConfirmation) patch.mailer_autoconfirm = false;

const res = await fetch(CONFIG_URL, { method: "PATCH", headers, body: JSON.stringify(patch) });
if (!res.ok) die(`Could not save the SMTP settings (${res.status}): ${await res.text()}`);

const after = await readConfig();
const ok =
  after.smtp_host === HOST &&
  String(after.smtp_port) === String(PORT) &&
  after.smtp_user === USER &&
  after.smtp_admin_email === FROM;

console.log("\nAfter:");
console.log(`  smtp_host            ${after.smtp_host}`);
console.log(`  smtp_port            ${after.smtp_port}`);
console.log(`  smtp_user            ${after.smtp_user}`);
console.log(`  sender               ${after.smtp_sender_name} <${after.smtp_admin_email}>`);
console.log(`  rate_limit_email_sent ${after.rate_limit_email_sent}/hour`);
console.log(`  mailer_autoconfirm   ${after.mailer_autoconfirm}`);

if (!ok) die("The settings did not read back as sent. Nothing is confirmed.");
console.log("\n✓ Saved.");

// A saved setting is not a delivered email. The only way to know the relay
// works is to make Supabase use it, so this asks for a real password-reset
// message and reports what the server said.
if (wantsTest) {
  if (!SUPABASE_URL || !ANON) die("EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are needed for --send-test");
  console.log(`\nAsking Supabase to send a reset code to ${sendTestTo} …`);
  const send = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ email: sendTestTo }),
  });
  const body = await send.text();
  if (send.ok) {
    console.log("✓ Supabase accepted it. Check the inbox — and the spam folder.");
    console.log("  If nothing arrives, the relay refused it: look at Brevo → Logs.");
  } else {
    console.log(`✗ Rejected (${send.status}): ${body}`);
    console.log("  A 429 means the rate limit; anything about SMTP means the credentials or sender.");
  }
}

if (!requireConfirmation && after.mailer_autoconfirm) {
  console.log(
    "\nNote: new accounts are still auto-confirmed, so sign-up sends no email.\n" +
    "Once a test message has actually arrived, re-run with --require-confirmation\n" +
    "to switch the emailed sign-up code back on.",
  );
}
