import { describe, it, expect } from "vitest";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { createAgentRuntime } from "../index.ts";
import { ScriptedModel } from "../loop.ts";
import { McpRegistry } from "../mcp/mcpRegistry.ts";
import { McpClient, type McpServerConfig, type McpTransport } from "../mcp/mcpClient.ts";

function fakeTransport(): McpTransport {
  return {
    async listTools() {
      return [{ name: "echo", description: "echo back", inputSchema: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] } }];
    },
    async callTool(_name, args) {
      return { content: `echo:${(args as { msg: string }).msg}` };
    },
  };
}

function server(id: string, approved: boolean): McpServerConfig {
  return { id, name: `srv-${id}`, approved, transport: fakeTransport() };
}

describe("MCP registry (feature-flagged)", () => {
  it("is a no-op when disabled: connectApproved returns nothing", async () => {
    const reg = new McpRegistry({ enabled: false });
    reg.addServer(server("gh", true));
    const defs = await reg.connectApproved();
    expect(defs).toHaveLength(0);
  });

  it("when enabled, connects only APPROVED servers", async () => {
    const reg = new McpRegistry({ enabled: true });
    reg.addServer(server("approved", true));
    reg.addServer(server("blocked", false));
    const defs = await reg.connectApproved();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toContain("approved");
    expect(defs[0].risk).toBe("external"); // gated by policy (default ask)
  });

  it("McpClient refuses to connect when disabled or unapproved", async () => {
    await expect(new McpClient(server("s", true), false).connect()).rejects.toThrow("disabled");
    await expect(new McpClient(server("s", false), true).connect()).rejects.toThrow("not approved");
  });
});

describe("MCP integration with the runtime", () => {
  function mkRuntime(root: string, mcp: { enabled?: boolean; servers?: McpServerConfig[] }) {
    let n = 0;
    let idc = 0;
    return createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel([{ text: "ok" }]),
      mcp,
      now: () => ++n,
      idFactory: () => `m${++idc}`,
    });
  }

  it("default (mcp disabled) adds no tools and does not change behavior", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-mcp-off-"));
    const runtime = mkRuntime(root, { enabled: false, servers: [server("gh", true)] });
    expect(runtime.mcpEnabled).toBe(false);
    const added = await runtime.connectMcp();
    expect(added).toHaveLength(0);
    // a normal run still completes as usual
    const res = await runtime.run("hi");
    expect(res.finalText).toBe("ok");
  });

  it("when enabled, connectMcp registers approved server tools", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-mcp-on-"));
    const runtime = mkRuntime(root, { enabled: true, servers: [server("gh", true)] });
    expect(runtime.mcpEnabled).toBe(true);
    const added = await runtime.connectMcp();
    expect(added).toHaveLength(1);
    expect(added[0]).toContain("gh__echo");
  });
});
