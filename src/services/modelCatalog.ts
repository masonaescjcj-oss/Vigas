/**
 * frontend/src/services/modelCatalog.ts
 * ---------------------------------------------------------------------------
 * Reading the model catalogue the admin panel edits.
 *
 * The picker used to be a hardcoded array in AgentChatScreen, which meant the
 * `models` table — with its min_tier column and its admin UI — changed nothing a
 * user could see. This is the read that connects them.
 *
 * Both tables are granted `select` to authenticated and anon, so this goes
 * straight through RLS rather than an edge function: a model catalogue is not
 * secret, and a round trip through a function would only add latency.
 * ---------------------------------------------------------------------------
 */

import { supabase } from "./supabase";
import {
  AUTO_MODEL,
  type CatalogModel,
  decorateModels,
  type ModelRow,
  type PlanRow,
} from "../core/models/tiering";

/**
 * The catalogue as this account sees it, Auto first.
 *
 * Falls back to Auto alone if the tables cannot be read. That is deliberately
 * minimal: Auto always works because it means "server decides", so a user whose
 * catalogue failed to load can still run something, and we avoid inventing a
 * list that might offer a model the server would refuse.
 */
export async function fetchModelCatalog(tier: string): Promise<CatalogModel[]> {
  try {
    const [models, plans] = await Promise.all([
      supabase.from("models").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("plans").select("key,display_name,sort_order"),
    ]);
    if (models.error) throw models.error;
    if (plans.error) throw plans.error;

    return decorateModels(
      (models.data ?? []) as ModelRow[],
      (plans.data ?? []) as PlanRow[],
      tier,
    );
  } catch (e) {
    console.error("Failed to load the model catalogue:", e);
    return [AUTO_MODEL];
  }
}
