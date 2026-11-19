/**
 * mcp/mcpRegistry.ts
 * ---------------------------------------------------------------------------
 * Manages the set of configured MCP servers. For the MVP this is config-based:
 * servers are added manually; there is no marketplace UI.
 *
 * The whole subsystem sits behind a feature flag. With `mcp_enabled=false`
 * (the default), `connectApproved()` is a no-op that returns no tools, so the
 * agent's default behavior is completely unaffected. Even when enabled, only
 * servers explicitly marked `approved` are ever connected.
 * ---------------------------------------------------------------------------
 */

import type { ToolDefinition } from "../toolRegistry.ts";
import { McpClient, type McpServerConfig } from "./mcpClient.ts";

export interface McpRegistryOptions {
  /** Feature flag. Default should be false in the MVP. */
  enabled: boolean;
}

export class McpRegistry {
  private readonly servers = new Map<string, McpServerConfig>();

  constructor(private readonly opts: McpRegistryOptions) {}

  get enabled(): boolean {
    return this.opts.enabled;
  }

  /** Manually register a server (config-based). */
  addServer(config: McpServerConfig): void {
    this.servers.set(config.id, config);
  }

  listServers(): Array<{ id: string; name: string; approved: boolean }> {
    return [...this.servers.values()].map((s) => ({ id: s.id, name: s.name, approved: s.approved }));
  }

  /**
   * Connect every approved server and return their wrapped tool definitions.
   * When the feature flag is off, returns [] and touches nothing.
   */
  async connectApproved(): Promise<ToolDefinition[]> {
    if (!this.opts.enabled) return [];
    const defs: ToolDefinition[] = [];
    for (const config of this.servers.values()) {
      if (!config.approved) continue; // never auto-connect an unapproved server
      const client = new McpClient(config, true);
      await client.connect();
      defs.push(...client.toToolDefinitions());
    }
    return defs;
  }
}
