/**
 * Covers the request-shaping logic added around the agent runtime: which models
 * a client may request, and what the audit sink records for the UI. Both are
 * pure functions, so they are tested without touching Supabase or an LLM.
 */
import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OpenAIChatModel, resolveRequestedModel } from "../shared/agentRuntime.ts";
import { AppError } from "../shared/errorHandler.ts";
import { PROJECT_TEMPLATES, templateContentType } from "../shared/templates.ts";
import { describeToolMetrics, describeToolTarget } from "../../../src/core/agent/hooks/defaultHooks.ts";

/**
 * Enough of the Supabase client for the catalogue lookup: `models` rows keyed by
 * id and `plans` rows keyed by key. Two tables, two `maybeSingle` reads.
 */
type Row = Record<string, unknown> | null;
function fakeService(
  models: Record<string, Row>,
  plans: Record<string, Row> = { free: { sort_order: 0 }, pro: { sort_order: 1 }, ultra: { sort_order: 2 } },
  failTable?: string,
) {
  // deno-lint-ignore no-explicit-any
  return {
    from(table: string) {
      const source = table === "models" ? models : plans;
      return {
        select: () => ({
          eq: (_column: string, value: string) => ({
            maybeSingle: () =>
              Promise.resolve(
                table === failTable
                  ? { data: null, error: { message: "relation does not exist" } }
                  : { data: source[value] ?? null, error: null },
              ),
          }),
        }),
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}

const CATALOGUE = {
  "gpt-5.6-luna": { id: "gpt-5.6-luna", is_active: true, min_tier: null },
  "deepseek-v4-flash": { id: "deepseek-v4-flash", is_active: true, min_tier: null },
  "deepseek-reasoner": { id: "deepseek-reasoner", is_active: true, min_tier: "pro" },
  "retired-model": { id: "retired-model", is_active: false, min_tier: null },
};

Deno.test("a free model is allowed on the free tier", async () => {
  const service = fakeService(CATALOGUE);
  assertEquals(await resolveRequestedModel(service, "gpt-5.6-luna", "free"), "gpt-5.6-luna");
  assertEquals(await resolveRequestedModel(service, "deepseek-v4-flash", "free"), "deepseek-v4-flash");
});

Deno.test("the server default is used for anything unrecognised", async () => {
  const service = fakeService(CATALOGUE);
  // "auto" means "server decides"; unknown or hostile input must not pass through.
  assertEquals(await resolveRequestedModel(service, "auto", "free"), undefined);
  assertEquals(await resolveRequestedModel(service, undefined, "free"), undefined);
  assertEquals(await resolveRequestedModel(service, "", "free"), undefined);
  assertEquals(await resolveRequestedModel(service, "gpt-4o-expensive", "free"), undefined);
  assertEquals(await resolveRequestedModel(service, "../../etc/passwd", "free"), undefined);
});

Deno.test("a model switched off falls back rather than failing the run", async () => {
  // is_active=false is how an operator takes a broken model out of service. The
  // kinder answer is a working model, not a dead end.
  const service = fakeService(CATALOGUE);
  assertEquals(await resolveRequestedModel(service, "retired-model", "pro"), undefined);
});

Deno.test("a premium model is refused on the free tier, by name", async () => {
  // The regression this exists for: min_tier was stored and editable in the
  // admin panel while the server read an environment variable instead, so a
  // free account could ask for the premium model and be served it.
  const service = fakeService(CATALOGUE);
  const error = await assertRejects(
    () => resolveRequestedModel(service, "deepseek-reasoner", "free"),
    AppError,
  );
  assertEquals(error.status, 403);
  assertEquals(error.code, "MODEL_REQUIRES_UPGRADE");
  // The app routes to the paywall on this code, and needs the tier to name it.
  assertEquals((error.details as { requiredTier: string }).requiredTier, "pro");
});

Deno.test("a premium model is allowed at its tier and above", async () => {
  const service = fakeService(CATALOGUE);
  assertEquals(await resolveRequestedModel(service, "deepseek-reasoner", "pro"), "deepseek-reasoner");
  assertEquals(await resolveRequestedModel(service, "deepseek-reasoner", "ultra"), "deepseek-reasoner");
});

Deno.test("an unrecognised tier is treated as the lowest, not the highest", async () => {
  // A typo in a profile row must not hand out the paid models.
  const service = fakeService(CATALOGUE);
  await assertRejects(
    () => resolveRequestedModel(service, "deepseek-reasoner", "enterprise-typo"),
    AppError,
  );
});

Deno.test("a model gated on a deleted plan stays locked rather than becoming free", async () => {
  // The two ranks fail closed in opposite directions. Ranking an unknown
  // *required* tier at 0 like an unknown *held* one would tie it with free and
  // hand the paid model to everybody — found by the equivalent client-side test.
  const service = fakeService({
    orphan: { id: "orphan", is_active: true, min_tier: "retired-plan" },
  });
  await assertRejects(() => resolveRequestedModel(service, "orphan", "free"), AppError);
  await assertRejects(() => resolveRequestedModel(service, "orphan", "ultra"), AppError);
});

Deno.test("an unreadable catalogue degrades to the fallback list", async () => {
  // Before the models table is migrated, or during a transient failure: the
  // usual models must keep working rather than every run refusing.
  const service = fakeService(CATALOGUE, undefined, "models");
  assertEquals(await resolveRequestedModel(service, "gpt-5.6-luna", "free"), "gpt-5.6-luna");
  assertEquals(await resolveRequestedModel(service, "never-heard-of-it", "free"), undefined);
});

Deno.test("every starter template has an entry file and sane content types", () => {
  for (const [key, template] of Object.entries(PROJECT_TEMPLATES)) {
    const paths = Object.keys(template.files);
    assertEquals(paths.includes("index.html"), true, `${key} must ship an index.html`);
    for (const path of paths) {
      assertEquals(template.files[path].length > 0, true, `${key}:${path} must not be empty`);
    }
  }
  assertEquals(templateContentType("a/index.html"), "text/html; charset=utf-8");
  assertEquals(templateContentType("styles.css"), "text/css; charset=utf-8");
  assertEquals(templateContentType("app.js"), "text/javascript; charset=utf-8");
  assertEquals(templateContentType("notes.md"), "text/markdown; charset=utf-8");
  assertEquals(templateContentType("noext"), "text/plain; charset=utf-8");
});

Deno.test("templates reference only files they actually ship", () => {
  const ref = /(?:href|src)="\.?\/?([^"#?]+)"/g;
  for (const [key, template] of Object.entries(PROJECT_TEMPLATES)) {
    const html = template.files["index.html"];
    for (const match of html.matchAll(ref)) {
      const target = match[1];
      if (target.startsWith("http")) continue;
      assertEquals(
        Object.keys(template.files).includes(target),
        true,
        `${key} references missing file ${target}`,
      );
    }
  }
});

Deno.test("audit target describes what a tool acted on", () => {
  assertEquals(describeToolTarget("read", { file_path: "index.html" }), "index.html");
  assertEquals(describeToolTarget("edit", { file_path: "src/a.ts" }), "src/a.ts");
  assertEquals(describeToolTarget("bash", { command: "npm test" }), "npm test");
  assertEquals(describeToolTarget("glob", { pattern: "**/*.ts" }), "**/*.ts");
  assertEquals(describeToolTarget("grep_files", { pattern: "TODO", glob: "*.ts" }), "TODO in *.ts");
  assertEquals(describeToolTarget("list_dir", {}), ".");
  assertEquals(describeToolTarget("todo_write", {}), undefined);
});

Deno.test("audit target collapses long commands instead of storing them whole", () => {
  const target = describeToolTarget("bash", { command: "echo " + "x".repeat(400) })!;
  assertEquals(target.length <= 120, true);
  assertEquals(target.endsWith("…"), true);
});

Deno.test("audit target names the file for a single-file patch", () => {
  const patch = "*** Begin Patch\n*** Update File: src/app.ts\n@@\n-a\n+b\n*** End Patch";
  assertEquals(describeToolTarget("apply_patch", { patch }), "src/app.ts");
});

Deno.test("audit metrics report line counts and edit deltas", () => {
  assertEquals(describeToolMetrics("read", {}, "1 line\n2 line\n3 line"), { lines: 3 });
  assertEquals(describeToolMetrics("write", { contents: "a\nb" }, ""), { plus: 2 });
  assertEquals(
    describeToolMetrics("edit", { old_string: "a", new_string: "x\ny" }, ""),
    { plus: 2, minus: 1 },
  );
  assertEquals(describeToolMetrics("todo_write", {}, "ignored"), undefined);
});

/**
 * A dropped connection to the model provider used to surface as a bare 500
 * ("an unexpected server error occurred"), which says neither what broke nor
 * that retrying is worth it. Chat mode answers synchronously now, so the user
 * reads this message directly.
 */
Deno.test("an unreachable model provider is a 502 that says to try again", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");
  globalThis.fetch = () => Promise.reject(new TypeError("fetch failed"));
  try {
    const model = new OpenAIChatModel("gpt-5.6-luna");
    const error = await model
      .generate({ systemPrompt: "s", messages: [], tools: [] })
      .then(() => null, (e) => e);
    assertEquals((error as { status?: number }).status, 502);
    assertEquals((error as { code?: string }).code, "MODEL_UNREACHABLE");
    assertStringIncludes((error as { message: string }).message, "try again");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) Deno.env.delete("OPENAI_API_KEY");
    else Deno.env.set("OPENAI_API_KEY", originalKey);
  }
});
