/**
 * scripts/check-export.ts
 * ---------------------------------------------------------------------------
 * "Download my project" is a trust feature, so the claim has to be proved end to
 * end rather than asserted:
 *
 *   - the link really serves a zip, to a client with no Supabase session
 *   - a real unzip (Python's zipfile) accepts it and every CRC matches
 *   - the contents equal the project's files exactly, binary bytes included
 *   - one user cannot export another user's project
 *   - the link is signed, not public: stripping the signature must fail
 *   - an empty project says so instead of handing over an empty archive
 *
 * Assertions are on error.code, not on the status: a missing route answers a bare
 * 404 that reads exactly like a refusal.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-export.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? "http://localhost:54321/functions/v1";
const BUCKET = Deno.env.get("PROJECT_FILES_BUCKET") ?? "project-files";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

/** A PNG header: real binary bytes, so a text round-trip would corrupt them. */
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

// Non-ASCII *content* but ASCII *names*: Supabase Storage refuses an object key
// containing non-ASCII characters ("Invalid key"), so a project cannot hold a
// file named in Persian in the first place. The zip writer's UTF-8 filename path
// is covered by its own unit test instead.
const TEXT_FILES: Record<string, string> = {
  "index.html": `<!doctype html><h1>Export ${stamp}</h1>\n`,
  "src/App.tsx": "export const App = () => null;\n",
  "assets/persian-content.txt": "سلام دنیا\n",
};

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

async function makeUser(tag: string) {
  const email = `exp-${tag}-${stamp}@example.com`;
  const password = `Ex-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  cleanup.push(() => admin.auth.admin.deleteUser(data.user!.id));
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { id: data.user!.id, token: signIn.session!.access_token };
}

async function makeProject(userId: string, name: string) {
  // sandbox_path is validated as users/<uid>/projects/<pid>, so the row is
  // inserted first and then given its real path.
  const { data, error } = await admin
    .from("projects").insert({ user_id: userId, name, sandbox_path: "pending" }).select().single();
  if (error) throw error;
  const id = String(data.id);
  const sandboxPath = `users/${userId}/projects/${id}`;
  await admin.from("projects").update({ sandbox_path: sandboxPath }).eq("id", id);
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", id); });
  return { id, sandboxPath };
}

/** Read a zip with something that did not write it. */
async function readZipWithPython(zip: Uint8Array): Promise<
  { ok: true; files: Record<string, string>; sizes: Record<string, number> } | { ok: false; why: string }
> {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeFile(`${dir}/export.zip`, zip);
    await Deno.writeTextFile(`${dir}/read.py`, `
import base64, json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    bad = z.testzip()
    if bad is not None:
        out = {"error": "crc failed for " + bad}
    else:
        out = {"b64": {n: base64.b64encode(z.read(n)).decode() for n in z.namelist()}}
with open(sys.argv[2], "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False)
`);
    const result = await new Deno.Command("python", {
      args: [`${dir}/read.py`, `${dir}/export.zip`, `${dir}/out.json`],
    }).output();
    if (!result.success) {
      return { ok: false, why: new TextDecoder().decode(result.stderr).slice(0, 400) };
    }
    const parsed = JSON.parse(await Deno.readTextFile(`${dir}/out.json`));
    if (parsed.error) return { ok: false, why: parsed.error };
    const files: Record<string, string> = {};
    const sizes: Record<string, number> = {};
    for (const [name, b64] of Object.entries(parsed.b64 as Record<string, string>)) {
      const raw = Uint8Array.from(atob(b64), (character) => character.charCodeAt(0));
      files[name] = new TextDecoder().decode(raw);
      sizes[name] = raw.length;
      // Keep the raw bytes for the binary comparison.
      (files as Record<string, unknown>)[`__raw__${name}`] = raw;
    }
    return { ok: true, files, sizes };
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => {});
  }
}

try {
  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");
  const project = await makeProject(owner.id, `Coffee Finder ${stamp}`);
  const empty = await makeProject(owner.id, `Empty ${stamp}`);

  // Seed the project's Storage prefix, text and binary.
  for (const [relative, text] of Object.entries(TEXT_FILES)) {
    const { error } = await admin.storage.from(BUCKET)
      .upload(`${project.sandboxPath}/${relative}`, new Blob([text]), { upsert: true });
    if (error) throw error;
  }
  {
    const { error } = await admin.storage.from(BUCKET)
      .upload(`${project.sandboxPath}/assets/pixel.png`, new Blob([PNG_BYTES]), {
        upsert: true, contentType: "image/png",
      });
    if (error) throw error;
  }
  // `.keep` marks an empty folder in Storage and must not appear in the export.
  await admin.storage.from(BUCKET)
    .upload(`${project.sandboxPath}/.keep`, new Blob([""]), { upsert: true });
  cleanup.push(async () => {
    const { data } = await admin.storage.from(BUCKET).list(project.sandboxPath);
    if (data) await admin.storage.from(BUCKET).remove(data.map((f) => `${project.sandboxPath}/${f.name}`));
  });

  const call = (jwt: string | null, body: unknown) =>
    fetch(`${API_URL}/project-export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify(body),
    });

  // ── The route exists. Every refusal below is meaningless otherwise.
  const routed = await call(owner.token, { projectId: project.id });
  const body = await routed.json().catch(() => ({}));
  const isRouted = routed.status !== 404 || typeof body?.error?.code === "string";
  check(`the export route is reachable (got ${routed.status})`, isRouted, body);
  if (!isRouted) throw new Error("project-export is not routed; the rest would prove nothing.");

  check(`exporting succeeds (got ${routed.status})`, routed.status === 200, body);
  check(`it reports the file count, excluding .keep (got ${body?.fileCount})`, body?.fileCount === 4, body);

  // ── The point of the feature: a client with no Supabase session downloads it.
  const bare = await fetch(String(body.url), { headers: { "cache-control": "no-cache" } });
  check(`the signed link serves without any credentials (got ${bare.status})`, bare.ok, {
    url: String(body.url).slice(0, 120),
  });
  check(
    `it is served as a zip (got ${bare.headers.get("content-type")})`,
    (bare.headers.get("content-type") ?? "").includes("zip"),
  );
  // download=<name> makes a browser save it rather than try to render it.
  check(
    `it downloads under the project's name (${bare.headers.get("content-disposition")?.slice(0, 60)})`,
    (bare.headers.get("content-disposition") ?? "").includes("coffee-finder"),
  );

  const zip = new Uint8Array(await bare.arrayBuffer());
  check(`the body is a zip (starts PK, ${zip.length} bytes)`, zip[0] === 0x50 && zip[1] === 0x4b);

  // ── A reader nobody here wrote.
  const read = await readZipWithPython(zip);
  if (!read.ok) {
    check(`a real unzip accepts the archive`, false, read.why);
  } else {
    check("a real unzip accepts it and every CRC matches", true);
    const names = Object.keys(read.files).filter((name) => !name.startsWith("__raw__")).sort();
    check(
      `it contains exactly the project's files (${names.join(", ")})`,
      JSON.stringify(names) === JSON.stringify([
        "assets/pixel.png", "assets/persian-content.txt", "index.html", "src/App.tsx",
      ].sort()),
      names,
    );
    check(".keep is not in the archive", !names.includes(".keep"), names);

    for (const [relative, text] of Object.entries(TEXT_FILES)) {
      check(`${relative} came back byte-identical`, read.files[relative] === text, {
        got: read.files[relative], want: text,
      });
    }

    // Binary is the one that silently breaks if anything decodes to text.
    const raw = (read.files as Record<string, unknown>)["__raw__assets/pixel.png"] as Uint8Array;
    check(
      `the PNG survived as binary (${raw?.length} of ${PNG_BYTES.length} bytes)`,
      !!raw && raw.length === PNG_BYTES.length && PNG_BYTES.every((byte, i) => raw[i] === byte),
      { got: [...(raw ?? [])].slice(0, 12), want: [...PNG_BYTES].slice(0, 12) },
    );
  }

  // ── The link must be signed, not merely obscure.
  const unsigned = String(body.url).split("?")[0];
  const stripped = await fetch(unsigned);
  check(`the same path without the signature is refused (got ${stripped.status})`, !stripped.ok, {
    status: stripped.status,
  });

  // ── Someone else's project.
  const trespass = await call(stranger.token, { projectId: project.id });
  const trespassBody = await trespass.json().catch(() => ({}));
  check(
    `a stranger cannot export it (${trespass.status} ${trespassBody?.error?.code})`,
    typeof trespassBody?.error?.code === "string" && trespass.status >= 400 && trespass.status < 500,
    trespassBody,
  );

  // ── An empty project.
  const emptyRes = await call(owner.token, { projectId: empty.id });
  const emptyBody = await emptyRes.json().catch(() => ({}));
  check(
    `an empty project says so rather than returning an empty zip (${emptyRes.status} ${emptyBody?.error?.code})`,
    emptyRes.status === 400 && emptyBody?.error?.code === "PROJECT_EMPTY",
    emptyBody,
  );

  // ── A project id that is not a uuid.
  const bad = await call(owner.token, { projectId: "not-a-uuid" });
  check(`a malformed project id is refused (got ${bad.status})`, bad.status === 400);

  // ── Old exports are pruned, so storage does not grow forever.
  await call(owner.token, { projectId: project.id });
  await call(owner.token, { projectId: project.id });
  await call(owner.token, { projectId: project.id });
  const { data: kept } = await admin.storage.from(BUCKET).list(`users/${owner.id}/exports/${project.id}`);
  check(`only the newest exports are kept (found ${kept?.length})`, (kept?.length ?? 0) <= 3, kept?.map((f) => f.name));
  cleanup.push(async () => {
    const { data } = await admin.storage.from(BUCKET).list(`users/${owner.id}/exports/${project.id}`);
    if (data?.length) {
      await admin.storage.from(BUCKET)
        .remove(data.map((f) => `users/${owner.id}/exports/${project.id}/${f.name}`));
    }
  });
} catch (error) {
  console.error("ERROR", error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) await step().catch(() => {});
}
