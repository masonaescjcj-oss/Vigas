/**
 * The provider sends tool arguments as a JSON string — verified against the real
 * API. What matters here is the failure modes, because the old code answered all
 * of them by substituting `{}`: the agent would then call `write` with no path or
 * `bash` with no command, and the resulting error looked like the tool's fault
 * rather than ours for dropping what the model said.
 */
import { assertEquals, assertThrows, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseToolArguments } from "../shared/agentRuntime.ts";
import { AppError } from "../shared/errorHandler.ts";

Deno.test("the normal case: a JSON string, exactly as the provider sends it", () => {
  assertEquals(
    parseToolArguments("write", '{"path":"index.html","content":"<h1>Hi</h1>"}'),
    { path: "index.html", content: "<h1>Hi</h1>" },
  );
});

Deno.test("an object is accepted, since not every provider stringifies", () => {
  assertEquals(parseToolArguments("write", { path: "a.txt" }), { path: "a.txt" });
});

Deno.test("no arguments is legitimate for a tool that takes none", () => {
  assertEquals(parseToolArguments("todo_write", ""), {});
  assertEquals(parseToolArguments("list_dir", undefined), {});
  assertEquals(parseToolArguments("list_dir", null), {});
  assertEquals(parseToolArguments("glob", "{}"), {});
});

Deno.test("truncated arguments fail loudly instead of running the tool empty", () => {
  // What a model out of room actually produces mid-argument.
  const cut = '{"path":"index.html","content":"<h1>Hi</h1';
  const error = assertThrows(() => parseToolArguments("write", cut), AppError);
  assertEquals((error as AppError).code, "MODEL_TOOL_ARGUMENTS_UNREADABLE");
});

Deno.test("the failure names the tool and tells the user what to do", () => {
  const error = assertThrows(() => parseToolArguments("write", "{oops")) as AppError;
  assertStringIncludes(error.message, "write");
  assertStringIncludes(error.message, "cut off");
  assertStringIncludes(error.message, "smaller change");
});

Deno.test("a JSON value that is not an object is refused", () => {
  // A bare string or array cannot be a tool's named arguments, and spreading one
  // would produce nonsense rather than an error.
  assertThrows(() => parseToolArguments("write", '"just a string"'), AppError);
  assertThrows(() => parseToolArguments("write", "[1,2,3]"), AppError);
  assertThrows(() => parseToolArguments("write", "42"), AppError);
});

Deno.test("an unnamed tool still produces a readable message", () => {
  const error = assertThrows(() => parseToolArguments(undefined, "{broken")) as AppError;
  assertStringIncludes(error.message, "a tool");
});
