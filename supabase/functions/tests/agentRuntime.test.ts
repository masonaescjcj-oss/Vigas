/**
 * Covers the request-shaping logic added around the agent runtime: which models
 * a client may request, and what the audit sink records for the UI. Both are
 * pure functions, so they are tested without touching Supabase or an LLM.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OpenAIChatModel, resolveRequestedModel } from "../shared/agentRuntime.ts";
import { PROJECT_TEMPLATES, templateContentType } from "../shared/templates.ts";
import { describeToolMetrics, describeToolTarget } from "../../../src/core/agent/hooks/defaultHooks.ts";

Deno.test("model allow-list accepts configured models", () => {
  assertEquals(resolveRequestedModel("gpt-5.6-luna"), "gpt-5.6-luna");
  assertEquals(resolveRequestedModel("deepseek-v4-flash"), "deepseek-v4-flash");
});

Deno.test("model allow-list falls back to the server default for anything else", () => {
  // "auto" means "server decides"; unknown or hostile input must not pass through.
  assertEquals(resolveRequestedModel("auto"), undefined);
  assertEquals(resolveRequestedModel(undefined), undefined);
  assertEquals(resolveRequestedModel(""), undefined);
  assertEquals(resolveRequestedModel("gpt-4o-expensive"), undefined);
  assertEquals(resolveRequestedModel("../../etc/passwd"), undefined);
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
