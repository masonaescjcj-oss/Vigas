/**
 * scripts/make-test-user.ts
 * ---------------------------------------------------------------------------
 * Create (or reset) a test account in your own Supabase project so you can sign
 * in and click around, then prove it actually works: sign in with the password,
 * check the profile row exists, and check a project read succeeds under RLS.
 *
 *   npx deno run --allow-all --env-file=.env scripts/make-test-user.ts
 *
 * Prints the credentials at the end. Delete the user from the Supabase
 * dashboard (Authentication → Users) when you are done with it.
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMAIL = Deno.env.get("TEST_EMAIL") ?? "tester@retrocode.app";
const PASSWORD = Deno.env.get("TEST_PASSWORD") ?? "RetroCode!2026";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 300)}`}`);
  if (!ok) Deno.exitCode = 1;
}

// Reuse the account across runs rather than piling up duplicates.
const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
const already = existing?.users.find((u) => u.email === EMAIL);

let userId: string;
if (already) {
  const { data, error } = await admin.auth.admin.updateUserById(already.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user!.id;
  console.log(`reset the password on the existing ${EMAIL}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true, // skip the confirmation mail; this is a test fixture
    user_metadata: { display_name: "Tester" },
  });
  if (error) throw error;
  userId = data.user!.id;
  console.log(`created ${EMAIL}`);
}

// 1. The password actually signs in.
const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
check("signing in with this password works", !signInError && !!signIn?.session, signInError);
if (!signIn?.session) Deno.exit(1);

// 2. A profile row exists — the app reads it for the display name and tier.
const { data: profile } = await admin.from("profiles").select("id,display_name,subscription_tier").eq("id", userId).maybeSingle();
check("the profile row exists", !!profile, profile);
if (profile && !profile.display_name) {
  await admin.from("profiles").update({ display_name: "Tester" }).eq("id", userId);
  console.log("      (filled in a display name)");
}

// 3. RLS reads work with this user's own token, which is what the app does.
const asUser = createClient(SUPABASE_URL, ANON, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
});
const { error: readError } = await asUser.from("projects").select("id").limit(1);
check("this user can read their projects under RLS", !readError, readError);

// 4. A usage row, so the token screen has something to show.
const { data: meter } = await admin.from("usage_metering").select("id").eq("user_id", userId).limit(1);
if (!meter?.length) console.log("note: no usage row yet — it is created on the first agent run");

console.log("\n────────────────────────────────");
console.log(`  email:    ${EMAIL}`);
console.log(`  password: ${PASSWORD}`);
console.log("────────────────────────────────");
