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
import { createToolRegistry } from "../../../src/core/agent/toolRegistry.ts";
import { PROJECT_TEMPLATES, templateContentType } from "../shared/templates.ts";
import { describeToolDetail, describeToolMetrics, describeToolTarget } from "../../../src/core/agent/hooks/defaultHooks.ts";

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
  // The fallback is ALLOWED_MODELS, which is the shipped model — terra.
  assertEquals(await resolveRequestedModel(service, "gpt-5.6-terra", "free"), "gpt-5.6-terra");
  // A model that was retired from the catalogue must not come back through the
  // fallback, or deactivating one would be cosmetic.
  assertEquals(await resolveRequestedModel(service, "gpt-5.6-luna", "free"), undefined);
  assertEquals(await resolveRequestedModel(service, "never-heard-of-it", "free"), undefined);
});

Deno.test("every starter template has an entry file and sane content types", () => {
  // An entry the preview can find, which is no longer always index.html: a
  // React Native project's entry is App.tsx, and mounting it is the shell's job.
  const ENTRIES = ["index.html", "App.tsx"];
  for (const [key, template] of Object.entries(PROJECT_TEMPLATES)) {
    const paths = Object.keys(template.files);
    assertEquals(
      paths.some((path) => ENTRIES.includes(path)),
      true,
      `${key} must ship one of ${ENTRIES.join(" / ")}, has ${paths.join(", ")}`,
    );
    for (const path of paths) {
      assertEquals(template.files[path].length > 0, true, `${key}:${path} must not be empty`);
    }
  }
  assertEquals(templateContentType("a/index.html"), "text/html; charset=utf-8");
  assertEquals(templateContentType("styles.css"), "text/css; charset=utf-8");
  assertEquals(templateContentType("app.js"), "text/javascript; charset=utf-8");
  assertEquals(templateContentType("notes.md"), "text/markdown; charset=utf-8");
  assertEquals(templateContentType("noext"), "text/plain; charset=utf-8");
  // The Expo starter's own files, which the seeding loop uploads by extension.
  assertEquals(templateContentType("App.tsx"), "text/plain; charset=utf-8");
  assertEquals(templateContentType("app.json"), "application/json; charset=utf-8");
});

Deno.test("templates reference only files they actually ship", () => {
  const ref = /(?:href|src)="\.?\/?([^"#?]+)"/g;
  // A relative import in a React Native entry, which has no index.html to scan.
  const relativeImport = /(?:from\s+|require\()\s*["'](\.[^"']+)["']/g;

  for (const [key, template] of Object.entries(PROJECT_TEMPLATES)) {
    const names = Object.keys(template.files);

    const html = template.files["index.html"];
    if (html) {
      for (const match of html.matchAll(ref)) {
        const target = match[1];
        if (target.startsWith("http")) continue;
        assertEquals(names.includes(target), true, `${key} references missing file ${target}`);
      }
    }

    // Same guarantee for a code entry: an import of a file the template forgot
    // to ship is a preview that opens on an error box.
    for (const path of names.filter((name) => /\.(tsx?|jsx?)$/.test(name))) {
      for (const match of template.files[path].matchAll(relativeImport)) {
        const target = match[1].replace(/^\.\//, "");
        const found = names.some((name) =>
          name === target || name.replace(/\.(tsx?|jsx?)$/, "") === target
        );
        assertEquals(found, true, `${key}:${path} imports missing file ${match[1]}`);
      }
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

Deno.test("the control-flow tools describe themselves", () => {
  // These had no case at all, so a run that was in fact methodical — plan,
  // list the work, tick items off — rendered as a stack of bare tool names
  // with nothing beside them.
  assertEquals(describeToolTarget("enter_plan_mode", {}), "working out the approach");
  assertEquals(describeToolTarget("exit_plan_mode", { plan: "1. do it" }), "plan ready");
  assertEquals(
    describeToolTarget("todo_write", {
      todos: [{ subject: "a", status: "completed" }, { subject: "b", status: "pending" }],
    }),
    "1/2 done",
  );
  assertEquals(
    describeToolTarget("ask_user", { questions: [{ header: "H", question: "Q?", options: [] }] }),
    "1 question",
  );
  // Plural, because "1 questions" is the kind of thing a user notices.
  assertEquals(
    describeToolTarget("ask_user", { questions: [{}, {}] }),
    "2 questions",
  );
});

Deno.test("only the plan and the checklist carry a readable payload", () => {
  // Everything else is described adequately by its target, and attaching more
  // would put file contents into audit rows.
  assertEquals(describeToolDetail("read", { file_path: "a.ts" }), undefined);
  assertEquals(describeToolDetail("bash", { command: "npm test" }), undefined);
  assertEquals(describeToolDetail("write", { file_path: "a.ts", contents: "secret" }), undefined);

  assertEquals(describeToolDetail("exit_plan_mode", { plan: "  1. do it  " }), {
    kind: "plan",
    plan: "1. do it",
  });
  assertEquals(describeToolDetail("todo_write", {
    todos: [{ subject: "a", status: "completed" }],
  }), { kind: "todos", todos: [{ subject: "a", status: "completed" }] });
});

Deno.test("a malformed or oversized payload cannot bloat a transcript row", () => {
  // An empty plan is nothing to show, not an empty card.
  assertEquals(describeToolDetail("exit_plan_mode", { plan: "   " }), undefined);
  assertEquals(describeToolDetail("todo_write", { todos: [] }), undefined);
  assertEquals(describeToolDetail("todo_write", { todos: "not an array" }), undefined);

  // Items with no subject are dropped rather than rendered as blank rows.
  assertEquals(describeToolDetail("todo_write", {
    todos: [{ subject: "", status: "pending" }, { subject: "real", status: "pending" }],
  }), { kind: "todos", todos: [{ subject: "real", status: "pending" }] });

  // Every row of the transcript carries this, so both are capped.
  const hugePlan = describeToolDetail("exit_plan_mode", { plan: "x".repeat(9000) });
  assertEquals((hugePlan as { plan: string }).plan.length, 4000);
  const manyTodos = describeToolDetail("todo_write", {
    todos: Array.from({ length: 80 }, (_, i) => ({ subject: `step ${i}`, status: "pending" })),
  });
  assertEquals((manyTodos as { todos: unknown[] }).todos.length, 30);

  // A status the UI does not know renders as not-started rather than throwing.
  assertEquals(describeToolDetail("todo_write", {
    todos: [{ subject: "a" }],
  }), { kind: "todos", todos: [{ subject: "a", status: "pending" }] });
});

Deno.test("a tool the environment cannot run is withheld, not offered", async () => {
  // The behaviour this guards: given `bash`, the model plans a typecheck or an
  // install, calls it, gets "Deno.makeTempDirSync is blocklisted", and carries
  // on with a plan whose middle step never happened. Measured on the deployed
  // worker before this existed — the run "succeeded" having verified nothing.
  const { createToolRegistry } = await import("../../../src/core/agent/toolRegistry.ts");

  const full = createToolRegistry().list().map((t) => t.name);
  assertEquals(full.includes("bash"), true, "bash is a core tool");

  const limited = createToolRegistry([], ["bash"]).list().map((t) => t.name);
  assertEquals(limited.includes("bash"), false, "bash must be absent, not just failing");

  // Everything else survives: the file tools never touch a sandbox, which is
  // why building an app works without one at all.
  for (const name of ["read", "write", "edit", "apply_patch", "glob", "grep_files", "list_dir"]) {
    assertEquals(limited.includes(name), true, `${name} should still be offered`);
  }
  assertEquals(limited.length, full.length - 1);
});

Deno.test("excluding nothing leaves the registry untouched", () => {
  // The E2B path passes an empty list, and it must not quietly drop anything.
  const full = createToolRegistry().list().map((t) => t.name).sort();
  const same = createToolRegistry([], []).list().map((t) => t.name).sort();
  assertEquals(same, full);
});

Deno.test("an unknown name in the exclude list is harmless", () => {
  // A typo should not silently remove a different tool or throw mid-run.
  const full = createToolRegistry().list().length;
  assertEquals(createToolRegistry([], ["nonexistent_tool"]).list().length, full);
});
