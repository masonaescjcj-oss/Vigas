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
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  LocalSandboxProvider,
  MAX_COMMAND_TIMEOUT_MS,
  clampTimeout,
} from "../shared/localProvider.ts";

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

Deno.test("listFiles returns paths downloadFile can resolve", async () => {
  // The round trip that failed in production. syncSandboxFiles lists the
  // sandbox, strips the project prefix to get a storage key, and hands the
  // *unstripped* path back to downloadFile. Relative paths made downloadFile
  // resolve against the sandbox root, so the first file broke the sync:
  //   No such file or directory: readfile '/var/lib/.../<sandbox>/.keep'
  const provider = new LocalSandboxProvider();
  const id = await provider.createSandbox("test");

  await provider.uploadFile(id, "/home/user/project/.keep", "");
  await provider.uploadFile(id, "/home/user/project/index.html", "<h1>hi</h1>");
  await provider.uploadFile(id, "/home/user/project/src/app.js", "export {};");

  const listed = await provider.listFiles(id, "/home/user/project");
  assertEquals(listed.length, 3);

  for (const path of listed) {
    assertEquals(path.startsWith("/home/user/project/"), true, `not rooted: ${path}`);
    // The real assertion: every listed path must be downloadable as-is.
    await provider.downloadFile(id, path);
  }

  const html = new TextDecoder().decode(
    await provider.downloadFile(id, "/home/user/project/index.html"),
  );
  assertEquals(html, "<h1>hi</h1>");

  // Nested files keep their subdirectory, or the sync flattens the project.
  assertEquals(listed.includes("/home/user/project/src/app.js"), true, listed.join(", "));

  await provider.destroySandbox(id);
});

Deno.test("a file written by a command comes back in the listing", async () => {
  // What the whole sandbox exists for: the agent runs something, and what it
  // produced has to reach Storage.
  const provider = new LocalSandboxProvider();
  const id = await provider.createSandbox("test");
  const connection = await provider.connect(id);

  await (await connection.startCommand(
    WINDOWS ? "echo built > out.txt" : "echo built > out.txt",
    ".",
  )).wait();

  const listed = await provider.listFiles(id, "/home/user/project");
  assertEquals(listed.includes("/home/user/project/out.txt"), true, listed.join(", "));
  const body = new TextDecoder().decode(
    await provider.downloadFile(id, "/home/user/project/out.txt"),
  );
  assertEquals(body.trim(), "built");

  await provider.destroySandbox(id);
});

Deno.test("a command that never exits is killed rather than hanging the run", async () => {
  // The failure a real build hit: the agent typed `npm run dev`, which does not
  // return. timeoutMs was accepted and ignored — `.output()` waits as long as
  // the command runs — so the build froze with no output and no error, holding
  // its queue lease until something outside killed it. Measured on the server:
  // a vite dev server still up after six minutes.
  const provider = new LocalSandboxProvider();
  const id = await provider.createSandbox("timeout-test");

  const forever = Deno.build.os === "windows"
    ? "ping -n 60 127.0.0.1 > nul"
    : "sleep 60";

  const started = Date.now();
  const result = await provider.runCommand(id, forever, { timeoutMs: 1_500 });
  const elapsed = Date.now() - started;

  assertEquals(result.exitCode, 124, "should report the conventional timeout code");
  assertEquals(elapsed < 20_000, true, `took ${elapsed}ms — it was not killed`);
  // The model has to be able to act on this, so it has to say what happened.
  assertEquals(/killed after/i.test(result.stderr), true, result.stderr);
  assertEquals(/dev server/i.test(result.stderr), true, result.stderr);

  await provider.destroySandbox(id);
});

Deno.test("a command that finishes is unaffected", async () => {
  // The timeout must not become a ceiling on ordinary work.
  const provider = new LocalSandboxProvider();
  const id = await provider.createSandbox("timeout-ok");
  const result = await provider.runCommand(id, "echo done", { timeoutMs: 30_000 });
  assertEquals(result.exitCode, 0);
  assertEquals(result.stdout.trim(), "done");
  await provider.destroySandbox(id);
});

Deno.test("the timeout cannot be waived or set absurdly high", () => {
  // A model asking for no timeout, or for a day, is how this comes back.
  assertEquals(clampTimeout(undefined), DEFAULT_COMMAND_TIMEOUT_MS);
  assertEquals(clampTimeout(0), DEFAULT_COMMAND_TIMEOUT_MS);
  assertEquals(clampTimeout(-1), DEFAULT_COMMAND_TIMEOUT_MS);
  assertEquals(clampTimeout(NaN), DEFAULT_COMMAND_TIMEOUT_MS);
  assertEquals(clampTimeout(86_400_000), MAX_COMMAND_TIMEOUT_MS);
  // A smaller request is honoured — the model may know a command is quick.
  assertEquals(clampTimeout(5_000), 5_000);
});
