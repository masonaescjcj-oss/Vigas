import { asc, eq } from 'drizzle-orm';
import type { ModelInfo, ModelTag, ProviderEndpoint } from '@vigas/core';
import type { Db } from './client';
import { modelEndpoints, models } from './schema';

type ModelRow = typeof models.$inferSelect;

const toModel = (m: ModelRow): ModelInfo => ({
  id: m.id,
  name: m.name,
  org: m.org,
  contextLength: m.contextLength,
  inputPerMillionMicros: m.inputPerMillionMicros,
  outputPerMillionMicros: m.outputPerMillionMicros,
  tags: m.tags as ModelTag[],
  priceChange24h: m.priceChange24h,
  auto: m.auto,
  description: m.description ?? undefined,
});

export async function listModels(db: Db): Promise<ModelInfo[]> {
  const rows = await db.select().from(models).where(eq(models.enabled, true)).orderBy(asc(models.name));
  return rows.map(toModel);
}

export async function getModel(db: Db, id: string): Promise<ModelInfo | null> {
  const [row] = await db.select().from(models).where(eq(models.id, id)).limit(1);
  return row && row.enabled ? toModel(row) : null;
}

export async function listEndpoints(db: Db): Promise<ProviderEndpoint[]> {
  const rows = await db.select().from(modelEndpoints);
  return rows.map((e) => ({
    modelId: e.modelId,
    provider: e.provider,
    upstreamModel: e.upstreamModel,
    inputPerMillionMicros: e.inputPerMillionMicros,
    outputPerMillionMicros: e.outputPerMillionMicros,
    priority: e.priority,
    enabled: e.enabled,
  }));
}
