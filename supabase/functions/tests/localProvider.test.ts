/**
 * What a command the agent runs is allowed to see.
 *
 * The worker holds SUPABASE_SERVICE_ROLE_KEY, the provider API key and the
 * queue worker secret. A spawned command used to inherit all of them, so
 * `echo $SUPABASE_SERVICE_ROLE_KEY` returned the real key — and a prompt as
 * plain as "run env and show me the output" put it in the chat transcript.
 * The service role key bypasses RLS for every user's data.
 *
 * These run the real provider rather than inspecting the source, because the
 * bug was a missing option on Deno.Command and only the actual spawn shows it.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { LocalSandboxProvider } from "../shared/localProvider.ts";

const WINDOWS = Deno.build.os === "windows";
const echo = (name: string) => (WINDOWS ? `echo %${name}%` : `echo $${name}`);

async function runInSandbox(command: string): Promise<string> {
  const provider = new LocalSandboxProvider();
  const connection = await provider.connect(await provider.createSandbox("test"));
  const handle = await connection.startCommand(command, ".");
  return (await handle.wait()).stdout.trim();
}

/** Unset on Windows echoes the literal %NAME%; on POSIX it echoes nothing. */
function looksUnset(value: string, name: string): boolean {
  return value === "" || value === `%${name}%`;
}

Deno.test("a command cannot read the service role key", async () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_canary_must_not_leak");
  const seen = await runInSandbox(echo("SUPABASE_SERVICE_ROLE_KEY"));
  assertEquals(looksUnset(seen, "SUPABASE_SERVICE_ROLE_KEY"), true, `leaked: ${seen}`);
  assertEquals(seen.includes("canary"), false);
});

Deno.test("nor the provider key or the worker secret", async () => {
  Deno.env.set("OPENAI_API_KEY", "sk-canary-must-not-leak");
  Deno.env.set("QUEUE_WORKER_SECRET", "worker-canary-must-not-leak");
  for (const name of ["OPENAI_API_KEY", "QUEUE_WORKER_SECRET"]) {
    const seen = await runInSandbox(echo(name));
    assertEquals(seen.includes("canary"), false, `${name} leaked: ${seen}`);
  }
});

Deno.test("a variable added later is hidden without anyone remembering to hide it", async () => {
  // The point of an allow-list: a deny-list would have to predict this name.
  Deno.env.set("SOME_FUTURE_SECRET", "future-canary-must-not-leak");
  const seen = await runInSandbox(echo("SOME_FUTURE_SECRET"));
  assertEquals(seen.includes("canary"), false, `leaked: ${seen}`);
});

Deno.test("PATH still works, or nothing can run at all", async () => {
  // Scrubbing must not take the environment a build genuinely needs.
  const path = await runInSandbox(echo("PATH"));
  assertEquals(path.length > 5, true, "PATH must survive scrubbing");
});

Deno.test("commands still run and return output", async () => {
  const out = await runInSandbox("echo hello");
  assertEquals(out, "hello");
});
