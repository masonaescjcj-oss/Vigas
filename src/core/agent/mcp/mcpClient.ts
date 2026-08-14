/**
 * mcp/mcpClient.ts
 * ---------------------------------------------------------------------------
 * A minimal MCP (Model Context Protocol) client. It connects to an external
 * MCP server through an injected transport, lists that server's tools, and
 * wraps them as Phase-1 ToolDefinitions so they can be added to the registry.
 *
 * Safety posture for the MVP:
 *   - A server is only contacted when the MCP feature flag is ON.
 *   - A server is only connected when it is explicitly `approved` — there is no
 *     automatic connection to any server.
 *   - MCP tools are risk="external", so the policy engine gates every call
 *     (default: ask) rather than letting them run unattended.
 * ---------------------------------------------------------------------------
 */

import type { JSONSchema, ToolDefinition, ToolResult } from "../toolRegistry.ts";

export interface McpToolSpec {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

/** Transport abstraction — a real impl wraps stdio/HTTP+SSE to the server. */
export interface McpTransport {
  listTools(): Promise<McpToolSpec[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<{ content: string; isError?: boolean }>;
}

export interface McpServerConfig {
  id: string;
  name: string;
  /** Must be explicitly true before we will ever connect. */
  approved: boolean;
  transport: McpTransport;
}

export class McpClient {
  private tools: McpToolSpec[] = [];
  private connected = false;

  constructor(
    private readonly config: McpServerConfig,
    private readonly enabled: boolean,
  ) {}

  get serverId(): string {
    return this.config.id;
  }
  get isConnected(): boolean {
    return this.connected;
  }

  /** Connect and cache the server's tool list. Refuses when disabled/unapproved. */
  async connect(): Promise<McpToolSpec[]> {
    if (!this.enabled) {
      throw new Error(`MCP is disabled; refusing to connect to "${this.config.id}".`);
    }
    if (!this.config.approved) {
      throw new Error(`MCP server "${this.config.id}" is not approved; connection blocked.`);
    }
    this.tools = await this.config.transport.listTools();
    this.connected = true;
    return this.tools;
  }

  /** Wrap the connected server's tools as registry tool definitions. */
  toToolDefinitions(prefix = "mcp__"): ToolDefinition[] {
    return this.tools.map((t): ToolDefinition => ({
      name: `${prefix}${this.config.id}__${t.name}`,
      description: `[MCP:${this.config.name}] ${t.description}`,
      risk: "external", // gated by the policy engine (default: ask)
      mutatesWorkspace: false,
      parameters: t.inputSchema,
      handler: async (input): Promise<ToolResult> => {
        const r = await this.config.transport.callTool(t.name, input as Record<string, unknown>);
        return { content: r.content, isError: r.isError };
      },
    }));
  }
}
