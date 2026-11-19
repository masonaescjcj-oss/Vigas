import type { SupabaseClient } from "@supabase/supabase-js";

export class SandboxBudgetError extends Error {
  readonly status = 429;
  readonly code = "SANDBOX_BUDGET_EXCEEDED";
  constructor(readonly details: Record<string, number>) {
    super("Your sandbox execution budget is exhausted. Upgrade your plan to continue running code.");
    this.name = "SandboxBudgetError";
  }
}

export interface SandboxBudget {
  dailySeconds: number;
  monthlySeconds: number;
}

const DEFAULT_BUDGETS: Record<string, SandboxBudget> = {
  free: { dailySeconds: 900, monthlySeconds: 3_600 },
  pro: { dailySeconds: 7_200, monthlySeconds: 72_000 },
  team: { dailySeconds: 14_400, monthlySeconds: 144_000 },
};

export class SandboxCostTracker {
  constructor(private readonly client: SupabaseClient, private readonly budgets = DEFAULT_BUDGETS) {}

  private async tier(userId: string): Promise<string> {
    const { data, error } = await this.client.from("profiles").select("subscription_tier").eq("id", userId).single();
    if (error) throw error;
    return String(data?.subscription_tier ?? "free");
  }

  async assertWithinBudget(userId: string): Promise<void> {
    const tier = await this.tier(userId);
    const budget = this.budgets[tier] ?? this.budgets.free;
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data, error } = await this.client.from("sandbox_usage").select("started_at,ended_at,duration_seconds").eq("user_id", userId).gte("started_at", monthStart);
    if (error) throw error;
    let monthSeconds = 0;
    let daySeconds = 0;
    for (const row of data ?? []) {
      const seconds = row.ended_at
        ? Number(row.duration_seconds ?? 0)
        : Math.max(Number(row.duration_seconds ?? 0), Math.max(0, (Date.now() - Date.parse(String(row.started_at))) / 1000));
      monthSeconds += seconds;
      if (String(row.started_at) >= dayStart) daySeconds += seconds;
    }
    if (daySeconds >= budget.dailySeconds || monthSeconds >= budget.monthlySeconds) {
      throw new SandboxBudgetError({ dailySeconds: budget.dailySeconds, monthlySeconds: budget.monthlySeconds });
    }
  }

  async start(row: { userId: string; projectId: string; sessionId: string; sandboxId: string }): Promise<string> {
    await this.assertWithinBudget(row.userId);
    const { data, error } = await this.client.from("sandbox_usage").insert({ user_id: row.userId, project_id: row.projectId, session_id: row.sessionId, sandbox_id: row.sandboxId, status: "active" }).select("id").single();
    if (error || !data) throw error ?? new Error("Failed to record sandbox usage.");
    return String(data.id);
  }

  async command(usageId: string, durationMs: number, peakMemoryBytes: number): Promise<void> {
    const seconds = Math.max(0, Math.ceil(durationMs / 1000));
    const { error } = await this.client.rpc("record_sandbox_command", { p_usage_id: usageId, p_duration_seconds: seconds, p_peak_memory_bytes: Math.max(0, Math.floor(peakMemoryBytes)) });
    if (error) throw error;
  }

  async finish(usageId: string, status: "destroyed" | "error", errorMessage?: string): Promise<void> {
    const { data, error } = await this.client.from("sandbox_usage").select("started_at").eq("id", usageId).maybeSingle();
    if (error) throw error;
    const durationSeconds = data ? Math.max(0, Math.ceil((Date.now() - Date.parse(String(data.started_at))) / 1000)) : 0;
    const { error: updateError } = await this.client.from("sandbox_usage").update({ status, ended_at: new Date().toISOString(), duration_seconds: durationSeconds, error_message: errorMessage ?? null }).eq("id", usageId);
    if (updateError) throw updateError;
  }
}
