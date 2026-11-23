import { serverEnv } from './env';

export interface GatewayPoolKeyTelemetry {
  index: number;
  label: string;
  status: 'healthy' | 'cooling_down' | 'exhausted' | 'budget_capped';
  uses: number;
  inFlight: number;
  spentUsd: number;
  budgetUsd: number | null;
  cooldownRemainingSec: number;
}

export interface GatewayPoolTelemetry {
  strategy: string;
  total: number;
  healthy: number;
  coolingDown: number;
  exhausted: number;
  budgetCapped: number;
  keys: GatewayPoolKeyTelemetry[];
}

export async function fetchGatewayPools(): Promise<{ reachable: boolean; pools: Record<string, GatewayPoolTelemetry> }> {
  const { gatewayUrl, internalToken } = serverEnv();
  if (!internalToken) return { reachable: false, pools: {} };
  try {
    const res = await fetch(`${gatewayUrl}/v1/admin/pools`, {
      headers: { 'X-Vigas-Internal-Token': internalToken },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { reachable: false, pools: {} };
    const data = (await res.json()) as { pools?: Record<string, GatewayPoolTelemetry> };
    return { reachable: true, pools: data.pools ?? {} };
  } catch {
    return { reachable: false, pools: {} };
  }
}

export async function reloadGatewayPools(): Promise<{
  reloaded: boolean;
  syncedProviders?: number;
  totalDbKeys?: number;
  pools?: Record<string, GatewayPoolTelemetry>;
}> {
  const { gatewayUrl, internalToken } = serverEnv();
  if (!internalToken) return { reloaded: false };
  try {
    const res = await fetch(`${gatewayUrl}/v1/admin/pools/reload`, {
      method: 'POST',
      headers: { 'X-Vigas-Internal-Token': internalToken },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { reloaded: false };
    const data = (await res.json()) as {
      syncedProviders?: number;
      totalDbKeys?: number;
      pools?: Record<string, GatewayPoolTelemetry>;
    };
    return { reloaded: true, ...data };
  } catch {
    return { reloaded: false };
  }
}
