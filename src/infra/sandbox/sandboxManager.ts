import type { SupabaseClient } from "@supabase/supabase-js";
import { E2BProvider } from "./e2bProvider.ts";
import { SandboxCostTracker } from "./costTracker.ts";
import type { SandboxCommandResult, SandboxProvider } from "./types.ts";

const WARM_MS = 15 * 60 * 1_000;

export interface SandboxSession {
  userId: string;
  projectId: string;
  sessionId: string;
  sandboxId: string;
  usageId: string;
}

export class SandboxManager {
  private readonly provider: SandboxProvider;
  private readonly cost: SandboxCostTracker;
  private readonly sessions = new Map<string, SandboxSession>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly client: SupabaseClient, provider: SandboxProvider = new E2BProvider()) {
    this.provider = provider;
    this.cost = new SandboxCostTracker(client);
  }

  async acquire(userId: string, projectId: string, sessionId: string): Promise<SandboxSession> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      await this.touch(existing);
      return existing;
    }
    await this.cost.assertWithinBudget(userId);
    const { data: persisted, error } = await this.client.from("sandbox_usage").select("id,sandbox_id,user_id,project_id,session_id").eq("session_id", sessionId).eq("status", "active").maybeSingle();
    if (error) throw error;
    let sandboxId: string;
    let usageId: string;
    if (persisted) {
      sandboxId = String(persisted.sandbox_id);
      usageId = String(persisted.id);
      try {
        await this.provider.connect(sandboxId);
      } catch {
        await this.cost.finish(usageId, "error", "The remote sandbox expired before reconnection.");
        sandboxId = await this.provider.createSandbox(projectId);
        try {
          usageId = await this.cost.start({ userId, projectId, sessionId, sandboxId });
        } catch (error) {
          await this.provider.destroySandbox(sandboxId).catch(() => undefined);
          throw error;
        }
      }
    } else {
      sandboxId = await this.provider.createSandbox(projectId);
      try {
        usageId = await this.cost.start({ userId, projectId, sessionId, sandboxId });
      } catch (error) {
        await this.provider.destroySandbox(sandboxId).catch(() => undefined);
        throw error;
      }
    }
    const session = { userId, projectId, sessionId, sandboxId, usageId };
    this.sessions.set(sessionId, session);
    await this.touch(session);
    return session;
  }

  async runCommand(session: SandboxSession, command: string, options: { timeoutMs?: number; memoryLimitBytes?: number; cwd?: string } = {}): Promise<SandboxCommandResult> {
    await this.touch(session);
    try {
      const result = await this.provider.runCommand(session.sandboxId, command, options);
      await this.cost.command(session.usageId, result.durationMs, result.peakMemoryBytes);
      await this.touch(session);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async providerUploadFile(session: SandboxSession, path: string, content: string | Uint8Array): Promise<void> {
    await this.provider.uploadFile(session.sandboxId, path, content);
  }

  async providerDownloadFile(session: SandboxSession, path: string): Promise<Uint8Array> {
    return await this.provider.downloadFile(session.sandboxId, path);
  }

  async providerListFiles(session: SandboxSession, root: string): Promise<string[]> {
    return await this.provider.listFiles(session.sandboxId, root);
  }

  async touch(session: SandboxSession): Promise<void> {
    await this.provider.keepAlive(session.sandboxId, WARM_MS);
    const { error } = await this.client.from("sandbox_usage").update({ last_activity_at: new Date().toISOString() }).eq("id", session.usageId).eq("status", "active");
    if (error) throw error;
    const old = this.timers.get(session.sessionId);
    if (old) clearTimeout(old);
    const timer = setTimeout(() => { void this.destroySession(session.sessionId); }, WARM_MS);
    this.timers.set(session.sessionId, timer);
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    const timer = this.timers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.timers.delete(sessionId);
    try {
      await this.provider.destroySandbox(session.sandboxId);
      await this.cost.finish(session.usageId, "destroyed");
    } catch (error) {
      await this.cost.finish(session.usageId, "error", error instanceof Error ? error.message : String(error)).catch(() => undefined);
      throw error;
    }
  }
}
