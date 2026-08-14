# Issac Agent Core (`src/core/agent`)

The complete Issac coding-agent runtime, built in three phases and exposed
through one entry point, `createAgentRuntime`.

| Phase | Adds |
|-------|------|
| **1 — Foundation** | tool registry, sandbox workspace, checkpoints, the execution loop |
| **2 — Security & management** | sandbox profiles + pathGuard, permission engine + rules, Pre/PostToolUse hooks, session store/compaction/fork/resume/export |
| **3 — Advanced execution** | full Plan Mode, bounded parallel subagents, a feature-flagged MCP client |

> Architectural patterns were adapted as *logic* from open designs; no
> third-party source was copied. See the repo-root `NOTICE.md`.

## Layout

```
src/core/agent/
├── index.ts               createAgentRuntime — the single entry point
├── loop.ts                execution loop + per-tool security pipeline
├── toolRegistry.ts        tools: read/write/edit/apply_patch/grep/list_dir/bash/…
├── systemPrompt.ts        bilingual system prompt (transparency policy)
├── checkpoint.ts          VCS-free workspace snapshots (rollback)
├── workspace/sandboxFs.ts Workspace bound to disk, confined by pathGuard
├── sandbox/               profiles.ts (standard/readonly) · pathGuard.ts
├── permissions/           policyEngine.ts · rules.ts (6 default rules)
├── hooks/                 hookRunner.ts · defaultHooks.ts (audit/notify/secret-guard)
├── session/              sessionStore.ts · compact.ts · forkResume.ts · exporter.ts
├── plan/                  ← Phase 3
│   ├── types.ts           Plan / PlanStep / events
│   ├── planGenerator.ts   prompt → structured plan (NO tools run)
│   ├── planExecutor.ts    execute a plan (suggest / confirm / auto)
│   ├── planVerifier.ts    goal loop: verify → repair → re-verify until it passes
│   └── secureInvoker.ts   runs plan/subagent tools through the full security pipeline
├── subagent/              ← Phase 3
│   ├── spawner.ts         split into ≤3 independent subtasks; token-budget guard
│   ├── isolatedContext.ts per-subagent overlay (only relevant files)
│   └── mergeStrategy.ts   conservative merge; conflict never auto-overwrites
└── mcp/                   ← Phase 3 (feature-flagged, off by default)
    ├── mcpClient.ts       connect an approved MCP server, wrap its tools
    └── mcpRegistry.ts     manage servers; mcp_enabled=false → total no-op
```

## Plan Mode

`plan()` produces a structured, inspectable `Plan` (steps typed as
`file_create | file_edit | command_run | research`) **without running any
tool**. `runPlan()` then executes it under one of three autonomy modes that map
to the client's segmented control:

- `suggest` — show the plan only; execute nothing.
- `confirm` — ask before each step (via `confirmStep`); skip on decline.
- `auto` — execute every step.

Execution streams `PlanEvent`s (`plan:start`, `step:start/end`, `verify:*`,
`plan:end`) through `onPlanEvent`. After execution, **verification is a real
check**: `planVerifier` runs a configured command (e.g. `build`/`lint`/tests)
in the sandbox and inspects its result, retrying with an optional repair step
until it truly passes or `maxAttempts` is hit — this is the `/goal` loop, not a
one-shot "done".

Every plan/subagent tool call goes through the same PreToolUse → policy →
confirm → PostToolUse pipeline as the main loop (`plan/secureInvoker.ts`), so
Plan Mode cannot bypass permissions or the sandbox.

## Bounded parallel subagents

A plan is split into **at most 3** genuinely independent subtasks, and only when
the work cleanly separates by file set (union-find over shared files and
dependencies). Hard limits, all enforced and tested:

- never more than `maxSubagents` (default 3) run concurrently — the coordinator
  slices to the cap even if handed more;
- if estimated cost exceeds `tokenBudget` (default ~200k) or the work does not
  split, subagents are disabled and the plan runs serially;
- each subagent works on an **isolated overlay** of only its files, so parallel
  writes can't clobber each other;
- results are merged conservatively — two subagents editing the same file to
  different contents is a **conflict** that halts and surfaces for resolution;
  no version is ever silently overwritten.

Opt in per run with `runPlan(prompt, { parallel: true })`.

## MCP client (off by default)

`mcp/` provides a minimal MCP client so future phases can attach external tool
servers (GitHub, a database, …). It is behind a feature flag: with
`mcp: { enabled: false }` (the default) `connectMcp()` is a no-op and the agent
behaves exactly as without it. Even when enabled, only servers explicitly marked
`approved` are connected — there is no automatic connection — and MCP tools are
`risk: "external"`, so the policy engine gates every call.

## Usage

```ts
import { createAgentRuntime, type ChatModel } from "./core/agent/index.ts";

const model: ChatModel = { async generate(p) { return callProvider(p); } };

const runtime = createAgentRuntime({
  sandboxRoot: "/abs/path/to/project",
  model,
  profile: "standard",                       // or "readonly" (suggest-only)
  networkAllowlist: ["api.github.com"],
  confirm: async ({ toolName, reason }) => askUser(toolName, reason),
  subagent: { enabled: true, maxSubagents: 3, tokenBudget: 200_000 },
  mcp: { enabled: false },                    // feature flag off for the MVP
  verify: { command: "npm run build", maxAttempts: 3 },
  onPlanEvent: (e) => streamToClient(e),
});

// Plan-first:
const plan = await runtime.plan("Add pagination to the users API and test it.");
const result = await runtime.runPlan("Add pagination to the users API and test it.", {
  mode: "confirm",
  confirmStep: (step) => askUser(step.description),
});
console.log(result.execution.ok, result.verification?.passed);

// Direct conversational run (Phase 1/2) still works:
const chat = await runtime.run("What does auth/session.ts do?");

// Sessions:
await runtime.forkSession(chat.sessionId, 3);
await runtime.resumeSession(chat.sessionId);
const usage = await runtime.getUsage(chat.sessionId);
```

## Tests

```
npm install
npm run typecheck
npm run test           # vitest run
```

The suite (49 tests) covers path-traversal defense, the permission rules,
history compaction, the end-to-end secured run, all three Plan Mode autonomy
modes, the verifier goal loop, the subagent cap/token-budget/isolation/merge-
conflict behavior, and the MCP feature flag.

## Security guarantees (unchanged across all phases)

- No workspace/session upload to any third party — no such code path exists.
- Hooks are in-process TypeScript callbacks; no external shell scripts run.
- Subagents always run under an explicit concurrency cap and token budget.
- MCP servers are never auto-connected; each requires explicit approval.
- No "do not reveal the prompt" instruction — the system prompt is transparent.
