/**
 * scripts/check-signup.ts
 * ---------------------------------------------------------------------------
 * Can a stranger actually register?
 *
 * Every other check in this project creates its account through the admin API,
 * which skips the confirmation step entirely — so all of them passed while the
 * front door was shut. A real person signing up went to Supabase's shared
 * mailer, which sends two messages an hour for the whole project and then
 * refuses the registration outright.
 *
 * So this signs up the way the app does: the anon key, no admin privileges, no
 * shortcuts. It is the one check that would have caught it.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-signup.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  const stamp = crypto.randomUUID().slice(0, 8);
  const email = `newcomer-${stamp}@example.com`;
  const password = `Nc-${crypto.randomUUID()}`;

  // Exactly what the app does — the anon key and nothing else.
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signUp, error: signUpErr } = await anon.auth.signUp({ email, password });

  check(`signing up is accepted${signUpErr ? "" : ` (${email})`}`, !signUpErr, signUpErr?.message);
  if (signUp?.user?.id) {
    cleanup.push(() => admin.auth.admin.deleteUser(signUp.user!.id));
  }
  if (signUpErr) throw new Error("nothing below would mean anything");

  // The thing that was broken: a session, rather than "check your email" for a
  // message that never arrives.
  check(
    "the new account is signed in immediately, with no emailed code",
    !!signUp.session?.access_token,
    "no session came back — registration still waits on a confirmation email",
  );
  if (!signUp.session) throw new Error("no session");

  // The signup trigger has to have made the profile, or the app has an account
  // it cannot read a tier or an admin flag for.
  let profile: { id: string; is_admin: boolean } | null = null;
  for (let i = 0; i < 10 && !profile; i++) {
    const { data } = await admin
      .from("profiles").select("id,is_admin").eq("id", signUp.user!.id).maybeSingle();
    profile = data as typeof profile;
    if (!profile) await new Promise((r) => setTimeout(r, 500));
  }
  check("a profile row was created for them", !!profile, "the signup trigger did not fire");
  check("they are not an admin by accident", profile?.is_admin === false, profile);

  // And the account can actually do the thing it signed up for.
  const call = (name: string, body: unknown) =>
    fetch(`${API_URL}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        Authorization: `Bearer ${signUp.session!.access_token}`,
      },
      body: JSON.stringify(body),
    });

  const project = await call("projects-create", { name: `Newcomer ${stamp}`, template: "blank" });
  const projectBody = await project.json().catch(() => ({}));
  const projectId = projectBody?.project?.id;
  check(`a brand-new account can create a project (${project.status})`, !!projectId, projectBody);
  if (projectId) {
    cleanup.push(async () => { await admin.from("projects").delete().eq("id", projectId); });
  }

  // Signing out and back in, which is what they will do tomorrow.
  const { error: reSignInErr } = await anon.auth.signInWithPassword({ email, password });
  check("they can sign in again later", !reSignInErr, reSignInErr?.message);
} finally {
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
}
