/**
 * toolRegistry.ts
 * ---------------------------------------------------------------------------
 * Registry of agent tools for the Issac coding agent.
 *
 * This is an independent TypeScript implementation. The *architectural
 * patterns* it follows (plan-first execution, a small orthogonal tool surface,
 * an anchored search/replace edit primitive, a structured multi-file patch
 * envelope, and worktree-isolated subagents) are common to modern coding-agent
 * harnesses. No third-party source code was copied. Attribution for the
 * open-source designs these patterns were adapted from lives in NOTICE.md.
 *
 * Deliberately NOT ported (security):
 *   - Any automatic upload of the user's repository/session to a third-party
 *     bucket (the "gcs / trace upload" path). Issac never exfiltrates workspace
 *     contents. There is no disabled, commented, or feature-flagged variant of
 *     this anywhere in the codebase.
 *   - Any "session_state_upload" style background telemetry of user files.
 * ---------------------------------------------------------------------------
 */

/* =========================================================================
 * 1. Core types
 * ========================================================================= */
import { bashTool } from "./tools/bash.ts";
import {
  type ClarifyRequest,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  MIN_OPTIONS,
  parseClarifyRequest,
} from "./clarify.ts";

/** A JSON-Schema fragment describing a tool's parameters (draft-2020-12 subset). */
export interface JSONSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Classifies a tool by how far its effects reach and how reversible they are.
 * The agent runtime uses this to decide when to pause for user confirmation
 * (see the `action_safety` section of the system prompt).
 */
export type ToolRisk =
  | "read" //      pure reads, no side effects
  | "local" //     reversible local mutations (edit a file, write a scratch file)
  | "exec" //      runs shell commands — may have arbitrary effects
  | "external"; //  reaches shared/remote systems (network, VCS remotes)

export interface ToolResult {
  /** Human/model-readable text output. */
  content: string;
  /** Optional structured payload for programmatic consumers. */
  data?: unknown;
  /** True when the tool failed; `content` then describes the error. */
  isError?: boolean;
}

/**
 * The capability surface a tool is allowed to touch. Injecting this (rather
 * than importing `fs`/`child_process` directly) keeps the registry portable:
 * the same tools run against a local worktree, a Supabase-backed virtual FS,
 * or an in-memory sandbox in tests.
 */
export interface Workspace {
  /** Read a UTF-8 file. Throws if it does not exist. */
  readFile(path: string): Promise<string>;
  /** Write (create or overwrite) a UTF-8 file, creating parent dirs. */
  writeFile(path: string, contents: string): Promise<void>;
  /** True if a path exists. */
  exists(path: string): Promise<boolean>;
  /** Delete a file. */
  deleteFile(path: string): Promise<void>;
  /** Move/rename a file. */
  moveFile(from: string, to: string): Promise<void>;
  /** List directory entries (non-recursive). */
  listDir(path: string): Promise<Array<{ name: string; isDir: boolean }>>;
  /** Glob relative to the workspace root; returns matching file paths. */
  glob(pattern: string): Promise<string[]>;
  /**
   * Content search. Returns matches with file/line so the model can navigate.
   * Implementations should honor a ripgrep-like `glob` filter when provided.
   */
  grep(opts: {
    pattern: string;
    glob?: string;
    caseInsensitive?: boolean;
  }): Promise<Array<{ file: string; line: number; text: string }>>;
  /** Run a shell command in the workspace. */
  exec(opts: {
    command: string;
    timeoutMs?: number;
    background?: boolean;
  }): Promise<{ stdout: string; stderr: string; exitCode: number | null }>;
}

/**
 * Side channel the runtime provides to control-flow tools (plan mode, todo,
 * subagents). Kept separate from {@link Workspace} because these touch agent
 * state, not the filesystem.
 */
export interface AgentControl {
  enterPlanMode(): Promise<void>;
  exitPlanMode(plan: string): Promise<void>;
  setTodos(todos: Array<{ subject: string; status: TodoStatus }>): Promise<void>;
  /**
   * Put a question to the user and end the turn. The run cannot continue until
   * they answer, so implementations record it rather than block.
   */
  askUser(request: ClarifyRequest): Promise<void>;
  /**
   * Spawn a subagent. Implementations SHOULD run each subagent in an isolated
   * worktree/checkpoint so parallel agents never clobber each other's edits,
   * then fold results back into the parent (see the analysis report).
   */
  spawnSubagent(opts: {
    description: string;
    prompt: string;
    /** Optional named role/profile, e.g. "explore" | "implement" | "review". */
    role?: string;
  }): Promise<{ id: string; summary: string }>;
  waitForSubagents(ids: string[]): Promise<Array<{ id: string; summary: string }>>;
}

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface ToolExecContext {
  workspace: Workspace;
  control: AgentControl;
  /** Absolute path (or virtual root) the tools resolve relative paths against. */
  root: string;
  /** Whether the current turn is in plan mode (read-only). */
  planMode: boolean;
}

export interface ToolDefinition<Input = Record<string, unknown>> {
  name: string;
  /** One-paragraph description surfaced to the model. Original wording. */
  description: string;
  risk: ToolRisk;
  /** When true, the tool is blocked while the agent is in plan mode. */
  mutatesWorkspace: boolean;
  parameters: JSONSchema;
  handler: (input: Input, ctx: ToolExecContext) => Promise<ToolResult>;
}

/* =========================================================================
 * 2. Small helpers
 * ========================================================================= */

const ok = (content: string, data?: unknown): ToolResult => ({ content, data });
const fail = (content: string): ToolResult => ({ content, isError: true });

/** Guard mutating tools when the agent is in plan mode. */
function assertMutable(ctx: ToolExecContext, tool: string): void {
  if (ctx.planMode) {
    throw new Error(
      `Tool "${tool}" mutates the workspace and cannot run in plan mode. ` +
        `Call exit_plan_mode once the plan is approved.`,
    );
  }
}

/* =========================================================================
 * 3. apply_patch — structured multi-file patch envelope
 * -------------------------------------------------------------------------
 * Independent re-implementation of a well-known structured patch envelope
 * (see NOTICE.md for the format's origin). The grammar:
 *
 *   *** Begin Patch
 *   *** Add File: path/to/new.ts
 *   +line one
 *   +line two
 *   *** Update File: path/to/existing.ts
 *   *** Move to: path/to/renamed.ts        (optional, follows Update File)
 *   @@ optional context header
 *    unchanged context line (leading space)
 *   -removed line
 *   +added line
 *   *** Delete File: path/to/old.ts
 *   *** End Patch
 *
 * We parse the envelope, resolve each hunk against the current file content by
 * matching context + removed lines, and apply edits. Ambiguous or non-matching
 * hunks are rejected with a precise error rather than applied fuzzily.
 * ========================================================================= */

type PatchOp =
  | { kind: "add"; path: string; lines: string[] }
  | { kind: "delete"; path: string }
  | { kind: "update"; path: string; moveTo?: string; hunks: PatchHunk[] };

interface PatchHunk {
  /** Ordered lines: context (" "), removed ("-"), added ("+"). */
  lines: Array<{ type: " " | "-" | "+"; text: string }>;
}

const BEGIN = "*** Begin Patch";
const END = "*** End Patch";

export function parsePatch(patch: string): PatchOp[] {
  const raw = patch.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < raw.length && raw[i].trim() === "") i++;
  if (raw[i] !== BEGIN) {
    throw new Error(`apply_patch: expected "${BEGIN}" on the first line.`);
  }
  i++;

  const ops: PatchOp[] = [];
  while (i < raw.length) {
    const line = raw[i];
    if (line === END) return ops;

    if (line.startsWith("*** Add File: ")) {
      const path = line.slice("*** Add File: ".length).trim();
      i++;
      const lines: string[] = [];
      while (i < raw.length && raw[i].startsWith("+")) {
        lines.push(raw[i].slice(1));
        i++;
      }
      ops.push({ kind: "add", path, lines });
      continue;
    }

    if (line.startsWith("*** Delete File: ")) {
      ops.push({ kind: "delete", path: line.slice("*** Delete File: ".length).trim() });
      i++;
      continue;
    }

    if (line.startsWith("*** Update File: ")) {
      const path = line.slice("*** Update File: ".length).trim();
      i++;
      let moveTo: string | undefined;
      if (i < raw.length && raw[i].startsWith("*** Move to: ")) {
        moveTo = raw[i].slice("*** Move to: ".length).trim();
        i++;
      }
      const hunks: PatchHunk[] = [];
      let current: PatchHunk | null = null;
      while (i < raw.length && !raw[i].startsWith("*** ")) {
        const l = raw[i];
        if (l.startsWith("@@")) {
          current = { lines: [] };
          hunks.push(current);
          i++;
          continue;
        }
        if (!current) {
          current = { lines: [] };
          hunks.push(current);
        }
        const marker = l[0];
        if (marker === " " || marker === "-" || marker === "+") {
          current.lines.push({ type: marker, text: l.slice(1) });
        } else if (l === "") {
          current.lines.push({ type: " ", text: "" });
        } else {
          throw new Error(`apply_patch: malformed hunk line: ${JSON.stringify(l)}`);
        }
        i++;
      }
      ops.push({ kind: "update", path, moveTo, hunks });
      continue;
    }

    throw new Error(`apply_patch: unexpected directive: ${JSON.stringify(line)}`);
  }
  throw new Error(`apply_patch: missing "${END}".`);
}

/** Apply a single update hunk to file lines; returns new lines or throws. */
function applyHunk(fileLines: string[], hunk: PatchHunk): string[] {
  // Build the "before" (context + removed) block we need to locate.
  const before = hunk.lines
    .filter((l) => l.type === " " || l.type === "-")
    .map((l) => l.text);

  if (before.length === 0) {
    // Pure insertion with no anchor — append the added lines at end of file.
    return [...fileLines, ...hunk.lines.filter((l) => l.type === "+").map((l) => l.text)];
  }

  // Find the unique location where `before` matches.
  const matches: number[] = [];
  for (let start = 0; start + before.length <= fileLines.length; start++) {
    let hit = true;
    for (let k = 0; k < before.length; k++) {
      if (fileLines[start + k] !== before[k]) {
        hit = false;
        break;
      }
    }
    if (hit) matches.push(start);
  }
  if (matches.length === 0) {
    throw new Error("apply_patch: hunk context not found in target file.");
  }
  if (matches.length > 1) {
    throw new Error(
      "apply_patch: hunk context is ambiguous (matches multiple locations). " +
        "Add more surrounding context lines.",
    );
  }

  const start = matches[0];
  const rebuilt: string[] = [];
  let cursor = start;
  for (const l of hunk.lines) {
    if (l.type === " ") {
      rebuilt.push(fileLines[cursor]);
      cursor++;
    } else if (l.type === "-") {
      cursor++; // consume without emitting
    } else {
      rebuilt.push(l.text); // added line
    }
  }
  return [...fileLines.slice(0, start), ...rebuilt, ...fileLines.slice(cursor)];
}

async function applyPatch(patch: string, ws: Workspace): Promise<string[]> {
  const ops = parsePatch(patch);
  const touched: string[] = [];
  for (const op of ops) {
    if (op.kind === "add") {
      if (await ws.exists(op.path)) {
        throw new Error(`apply_patch: Add File target already exists: ${op.path}`);
      }
      await ws.writeFile(op.path, op.lines.join("\n"));
      touched.push(op.path);
    } else if (op.kind === "delete") {
      await ws.deleteFile(op.path);
      touched.push(op.path);
    } else {
      const original = await ws.readFile(op.path);
      let lines = original.split("\n");
      for (const hunk of op.hunks) lines = applyHunk(lines, hunk);
      const next = lines.join("\n");
      if (op.moveTo) {
        await ws.writeFile(op.moveTo, next);
        await ws.deleteFile(op.path);
        touched.push(`${op.path} -> ${op.moveTo}`);
      } else {
        await ws.writeFile(op.path, next);
        touched.push(op.path);
      }
    }
  }
  return touched;
}

/* =========================================================================
 * 4. Tool definitions
 * ========================================================================= */

const readTool: ToolDefinition<{ file_path: string; offset?: number; limit?: number }> = {
  name: "read",
  description:
    "Read a text file from the workspace and return its contents with 1-based " +
    "line numbers. Optionally start at `offset` and cap at `limit` lines for " +
    "large files. Prefer this over shelling out to cat/head/tail.",
  risk: "read",
  mutatesWorkspace: false,
  parameters: {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Path relative to the workspace root." },
      offset: { type: "integer", description: "1-based first line to read.", minimum: 1 },
      limit: { type: "integer", description: "Maximum number of lines.", minimum: 1 },
    },
    required: ["file_path"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    const text = await ctx.workspace.readFile(input.file_path);
    const all = text.split("\n");
    const start = (input.offset ?? 1) - 1;
    const end = input.limit ? start + input.limit : all.length;
    const slice = all.slice(start, end);
    const numbered = slice.map((l, idx) => `${String(start + idx + 1).padStart(6)}\t${l}`);
    return ok(numbered.join("\n"), { totalLines: all.length });
  },
};

const writeTool: ToolDefinition<{ file_path: string; contents: string }> = {
  name: "write",
  description:
    "Create a new file or fully overwrite an existing one. For targeted changes " +
    "to an existing file, prefer `edit` or `apply_patch` so unrelated content is " +
    "preserved.",
  risk: "local",
  mutatesWorkspace: true,
  parameters: {
    type: "object",
    properties: {
      file_path: { type: "string" },
      contents: { type: "string" },
    },
    required: ["file_path", "contents"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    assertMutable(ctx, "write");
    await ctx.workspace.writeFile(input.file_path, input.contents);
    return ok(`Wrote ${input.contents.length} bytes to ${input.file_path}.`);
  },
};

const editTool: ToolDefinition<{
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}> = {
  name: "edit",
  description:
    "Anchored search-and-replace within a single file. `old_string` must match " +
    "the file exactly and, unless `replace_all` is true, must be unique — the " +
    "edit is rejected on zero or multiple matches so it can never silently touch " +
    "the wrong location. Include enough surrounding context to make the anchor " +
    "unique.",
  risk: "local",
  mutatesWorkspace: true,
  parameters: {
    type: "object",
    properties: {
      file_path: { type: "string" },
      old_string: { type: "string", description: "Exact text to find (with context)." },
      new_string: { type: "string", description: "Replacement text." },
      replace_all: {
        type: "boolean",
        description: "Replace every occurrence instead of requiring uniqueness.",
      },
    },
    required: ["file_path", "old_string", "new_string"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    assertMutable(ctx, "edit");
    const text = await ctx.workspace.readFile(input.file_path);
    if (input.old_string === input.new_string) {
      return fail("edit: old_string and new_string are identical.");
    }
    if (input.replace_all) {
      const count = text.split(input.old_string).length - 1;
      if (count === 0) return fail("edit: old_string not found.");
      const next = text.split(input.old_string).join(input.new_string);
      await ctx.workspace.writeFile(input.file_path, next);
      return ok(`Replaced ${count} occurrence(s) in ${input.file_path}.`);
    }
    const first = text.indexOf(input.old_string);
    if (first === -1) return fail("edit: old_string not found.");
    const second = text.indexOf(input.old_string, first + input.old_string.length);
    if (second !== -1) {
      return fail(
        "edit: old_string is not unique. Add more surrounding context, or pass " +
          "replace_all: true if you mean to replace every occurrence.",
      );
    }
    const next =
      text.slice(0, first) + input.new_string + text.slice(first + input.old_string.length);
    await ctx.workspace.writeFile(input.file_path, next);
    return ok(`Edited ${input.file_path}.`);
  },
};

const applyPatchTool: ToolDefinition<{ patch: string }> = {
  name: "apply_patch",
  description:
    "Apply a structured, multi-file patch in a single call using a '*** Begin " +
    "Patch' / '*** End Patch' envelope with Add File / Update File / Delete File / " +
    "Move to directives and +/-/context hunks. Best for coordinated changes " +
    "spanning several files. Hunks are matched against current file content and " +
    "rejected if their context is missing or ambiguous.",
  risk: "local",
  mutatesWorkspace: true,
  parameters: {
    type: "object",
    properties: {
      patch: { type: "string", description: "The full patch envelope as text." },
    },
    required: ["patch"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    assertMutable(ctx, "apply_patch");
    try {
      const touched = await applyPatch(input.patch, ctx.workspace);
      return ok(`Applied patch. Touched:\n${touched.map((t) => `  - ${t}`).join("\n")}`, {
        touched,
      });
    } catch (e) {
      return fail((e as Error).message);
    }
  },
};

const grepTool: ToolDefinition<{
  pattern: string;
  glob?: string;
  case_insensitive?: boolean;
}> = {
  name: "grep_files",
  description:
    "Search file contents by regular expression and return matches as " +
    "file:line:text so you can navigate the codebase. Narrow the search with a " +
    "`glob` filter (e.g. '**/*.ts'). Use this instead of shelling out to grep/rg.",
  risk: "read",
  mutatesWorkspace: false,
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string" },
      glob: { type: "string", description: "Optional path glob to limit the search." },
      case_insensitive: { type: "boolean" },
    },
    required: ["pattern"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    const matches = await ctx.workspace.grep({
      pattern: input.pattern,
      glob: input.glob,
      caseInsensitive: input.case_insensitive,
    });
    if (matches.length === 0) return ok("No matches.");
    const body = matches.map((m) => `${m.file}:${m.line}:${m.text}`).join("\n");
    return ok(body, { count: matches.length });
  },
};

const listDirTool: ToolDefinition<{ path?: string }> = {
  name: "list_dir",
  description:
    "List the immediate entries of a directory (files and subdirectories), " +
    "marking which are directories. Non-recursive; combine with `glob` for deep " +
    "traversal.",
  risk: "read",
  mutatesWorkspace: false,
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path; defaults to the root." },
    },
    additionalProperties: false,
  },
  async handler(input, ctx) {
    const entries = await ctx.workspace.listDir(input.path ?? ctx.root);
    const body = entries
      .map((e) => (e.isDir ? `${e.name}/` : e.name))
      .sort()
      .join("\n");
    return ok(body || "(empty)", { count: entries.length });
  },
};

const globTool: ToolDefinition<{ pattern: string }> = {
  name: "glob",
  description:
    "Find files whose paths match a glob pattern (e.g. 'src/**/*.test.ts'). " +
    "Returns matching paths. Good for locating files by name or extension across " +
    "the tree.",
  risk: "read",
  mutatesWorkspace: false,
  parameters: {
    type: "object",
    properties: { pattern: { type: "string" } },
    required: ["pattern"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    const paths = await ctx.workspace.glob(input.pattern);
    return ok(paths.length ? paths.join("\n") : "(no matches)", { count: paths.length });
  },
};



/* ---- Control-flow tools: plan-first, todo, subagents -------------------- */

const askUserTool: ToolDefinition<{ questions: unknown }> = {
  name: "ask_user",
  description:
    "Ask the user to choose between options before you build. Use this when the " +
    "request leaves a decision open that would be expensive to get wrong — what " +
    "kind of app, which screens, what it should look like. Ask up to 3 questions " +
    "at once, each with 2-4 concrete options; an 'in your own words' choice is " +
    "added automatically, so never add one yourself. This ends your turn: the " +
    "user's answers arrive as the next message. Ask once, early, then build — do " +
    "not ask again for something you could reasonably decide.",
  risk: "read",
  mutatesWorkspace: false,
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 1,
        maxItems: MAX_QUESTIONS,
        items: {
          type: "object",
          properties: {
            header: { type: "string", description: "One or two words, e.g. \"Style\"." },
            question: { type: "string" },
            options: {
              type: "array",
              minItems: MIN_OPTIONS,
              maxItems: MAX_OPTIONS,
              items: {
                type: "object",
                properties: {
                  label: { type: "string", description: "Short — it is a button." },
                  description: { type: "string", description: "What choosing it means." },
                },
                required: ["label"],
                additionalProperties: false,
              },
            },
          },
          required: ["header", "question", "options"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    // A malformed call comes back as a correctable message rather than failing
    // the run: the model can fix its own arguments, the user cannot.
    const parsed = parseClarifyRequest(input);
    if (!parsed.ok) return { content: `Could not ask that: ${parsed.reason}`, isError: true };
    await ctx.control.askUser(parsed.request);
    return ok(
      `Asked the user ${parsed.request.questions.length} question(s). ` +
        `Your turn ends here; their answers will arrive as the next message.`,
    );
  },
};

const enterPlanModeTool: ToolDefinition<Record<string, never>> = {
  name: "enter_plan_mode",
  description:
    "Enter a read-only planning phase. While in plan mode you investigate and " +
    "draft a plan but must not mutate the workspace. Use this before any " +
    "non-trivial change so the user can review the approach first.",
  risk: "read",
  mutatesWorkspace: false,
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async handler(_input, ctx) {
    await ctx.control.enterPlanMode();
    return ok("Entered plan mode. The workspace is now read-only until exit_plan_mode.");
  },
};

const exitPlanModeTool: ToolDefinition<{ plan: string }> = {
  name: "exit_plan_mode",
  description:
    "Present the finished plan and leave plan mode so edits can begin. Provide the " +
    "plan as a concise, ordered list of the steps you intend to take.",
  risk: "read",
  mutatesWorkspace: false,
  parameters: {
    type: "object",
    properties: { plan: { type: "string" } },
    required: ["plan"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    await ctx.control.exitPlanMode(input.plan);
    return ok("Plan recorded. Plan mode exited; edits are now permitted.");
  },
};

const todoWriteTool: ToolDefinition<{
  todos: Array<{ subject: string; status: TodoStatus }>;
}> = {
  name: "todo_write",
  description:
    "Maintain the visible task list for the current piece of work. Keep exactly " +
    "one item 'in_progress' at a time and mark items 'completed' as you finish " +
    "them so the user can follow progress.",
  risk: "read",
  mutatesWorkspace: false,
  parameters: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            subject: { type: "string" },
            status: { type: "string", enum: ["pending", "in_progress", "completed"] },
          },
          required: ["subject", "status"],
        },
      },
    },
    required: ["todos"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    await ctx.control.setTodos(input.todos);
    return ok(`Task list updated (${input.todos.length} item(s)).`);
  },
};

const taskTool: ToolDefinition<{ description: string; prompt: string; role?: string }> = {
  name: "task",
  description:
    "Delegate a self-contained unit of work to a subagent. The subagent runs in " +
    "an isolated worktree/checkpoint so parallel subagents never conflict, and " +
    "returns a summary that is folded back into your context. Use for broad " +
    "searches or independent workstreams that can run in parallel.",
  risk: "local",
  mutatesWorkspace: false,
  parameters: {
    type: "object",
    properties: {
      description: { type: "string", description: "3-6 word label for the task." },
      prompt: { type: "string", description: "Full, standalone instructions for the subagent." },
      role: { type: "string", description: "Optional role/profile, e.g. explore|implement|review." },
    },
    required: ["description", "prompt"],
    additionalProperties: false,
  },
  async handler(input, ctx) {
    const r = await ctx.control.spawnSubagent(input);
    return ok(r.summary, { subagentId: r.id });
  },
};

/* =========================================================================
 * 5. Registry
 * ========================================================================= */

export const CORE_TOOLS: ToolDefinition[] = [
  // read surface
  readTool as ToolDefinition,
  listDirTool as ToolDefinition,
  globTool as ToolDefinition,
  grepTool as ToolDefinition,
  // write surface
  writeTool as ToolDefinition,
  editTool as ToolDefinition,
  applyPatchTool as ToolDefinition,
  // exec
  bashTool as ToolDefinition,
  // control flow
  askUserTool as ToolDefinition,
  enterPlanModeTool as ToolDefinition,
  exitPlanModeTool as ToolDefinition,
  todoWriteTool as ToolDefinition,
  taskTool as ToolDefinition,
];

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(tools: ToolDefinition[] = CORE_TOOLS) {
    for (const t of tools) this.register(t);
  }

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /** Export the schemas in the shape most chat-completion tool APIs expect. */
  toApiSchema(): Array<{
    type: "function";
    function: { name: string; description: string; parameters: JSONSchema };
  }> {
    return this.list().map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  /** Dispatch a tool call, enforcing plan-mode read-only semantics centrally. */
  async invoke(
    name: string,
    input: Record<string, unknown>,
    ctx: ToolExecContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return fail(`Unknown tool: ${name}`);
    if (ctx.planMode && tool.mutatesWorkspace) {
      return fail(`Tool "${name}" is blocked in plan mode.`);
    }
    try {
      return await tool.handler(input, ctx);
    } catch (e) {
      return fail(`${name} failed: ${(e as Error).message}`);
    }
  }
}

/**
 * Build the registry.
 *
 * @param extra   Tools beyond the core set.
 * @param exclude Names to leave out entirely.
 *
 * `exclude` exists because a tool the environment cannot run is worse than a
 * missing one. The model plans around what it is offered: given `bash` it will
 * decide to typecheck or install a dependency, call it, get an error it cannot
 * act on, and carry on with a plan whose middle step never happened. Removing
 * the name is the only way to tell it the truth — a description saying "this
 * may fail" is advice, not a constraint.
 */
export function createToolRegistry(
  extra: ToolDefinition[] = [],
  exclude: readonly string[] = [],
): ToolRegistry {
  const omit = new Set(exclude);
  return new ToolRegistry([...CORE_TOOLS, ...extra].filter((tool) => !omit.has(tool.name)));
}
