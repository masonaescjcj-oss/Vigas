import type { ToolDefinition } from "../toolRegistry.ts";

const fail = (content: string) => ({ content, isError: true as const });

/** Delegates execution to Workspace.exec; Edge StorageWorkspace routes this to E2B. */
export const bashTool: ToolDefinition<{
  command: string;
  timeout_ms?: number;
  background?: boolean;
}> = {
  name: "bash",
  description: "Run a shell command inside the isolated project sandbox.",
  risk: "exec",
  mutatesWorkspace: true,
  parameters: {
    type: "object",
    properties: { command: { type: "string" }, timeout_ms: { type: "integer", minimum: 1, maximum: 60_000 }, background: { type: "boolean" } },
    required: ["command"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    if (ctx.planMode) return fail("bash is disabled in plan mode; exit plan mode to run commands.");
    const result = await ctx.workspace.exec({ command: input.command, timeoutMs: input.timeout_ms, background: input.background });
    const content = [result.stdout && `stdout:\n${result.stdout}`, result.stderr && `stderr:\n${result.stderr}`, `exit: ${result.exitCode}`].filter(Boolean).join("\n");
    return { content, isError: result.exitCode !== 0 && result.exitCode !== null };
  },
};
