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
import { BILLING_ENABLED } from "../config/billing";

/**
 * Vigas Gateway & Google AI Studio models served directly through same-origin `/api/app/chat-ask`
 * using the user's $5.00 welcome credit (and $0 free tier for Gemini 4 Hydrogen Free).
 */
export const VIGAS_DIRECT_MODELS: CatalogModel[] = [
  {
    id: "google/gemini-4-hydrogen:free",
    name: "Gemini 4 Hydrogen (Free)",
    description: "Google Gemini 4 Hydrogen · 1M context · Free",
    tone: "success",
    icon: "zap",
    isDefault: true,
    minTier: null,
    locked: false,
    badge: "FREE",
  },
  {
    id: "google/gemini-4-hydrogen",
    name: "Gemini 4 Hydrogen",
    description: "Google Gemini 4 Hydrogen · Priority · Uses $5 credit",
    tone: "brandPrimary",
    icon: "sparkles",
    isDefault: false,
    minTier: null,
    locked: false,
    badge: "$5 CREDIT",
  },
  {
    id: "google/gemini-4-carbon",
    name: "Gemini 4 Carbon",
    description: "Google Gemini 4 Carbon · Reasoning · Uses $5 credit",
    tone: "brandPrimary",
    icon: "cpu",
    isDefault: false,
    minTier: null,
    locked: false,
    badge: "$5 CREDIT",
  },
  {
    id: "anthropic/claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    description: "Anthropic Claude Sonnet 5.5 · Coding · Uses $5 credit",
    tone: "warning",
    icon: "sparkles",
    isDefault: false,
    minTier: null,
    locked: false,
    badge: "$5 CREDIT",
  },
];

function mergeWithVigasModels(remote: CatalogModel[]): CatalogModel[] {
  const auto = remote.find((m) => m.id === AUTO_MODEL.id) ?? AUTO_MODEL;
  const seen = new Set<string>([auto.id]);
  const out: CatalogModel[] = [auto];

  for (const m of VIGAS_DIRECT_MODELS) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  for (const m of remote) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

/**
 * The catalogue as this account sees it, Auto + Vigas Hydrogen & Free models first.
 */
export async function fetchModelCatalog(tier: string): Promise<CatalogModel[]> {
  try {
    const [models, plans] = await Promise.all([
      supabase.from("models").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("plans").select("key,display_name,sort_order"),
    ]);
    if (models.error) throw models.error;
    if (plans.error) throw plans.error;

    const remote = decorateModels(
      (models.data ?? []) as ModelRow[],
      (plans.data ?? []) as PlanRow[],
      tier,
      BILLING_ENABLED,
    );
    return mergeWithVigasModels(remote);
  } catch (e) {
    console.error("Failed to load the model catalogue:", e);
    return mergeWithVigasModels([AUTO_MODEL]);
  }
}
