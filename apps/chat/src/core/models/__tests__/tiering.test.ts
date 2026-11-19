/**
 * Turning catalogue rows into picker entries: what is locked, and what the badge
 * says. The server enforces the same rule independently — this is what stops a
 * user being shown a model that would then be refused.
 */

import { describe, expect, it } from "vitest";
import {
  AUTO_MODEL,
  decorateModels,
  heldRank,
  type ModelRow,
  type PlanRow,
  requiredRank,
} from "../tiering";

const PLANS: PlanRow[] = [
  { key: "free", display_name: "Free", sort_order: 0 },
  { key: "pro", display_name: "Pro", sort_order: 1 },
  { key: "ultra", display_name: "Ultra", sort_order: 2 },
];

const MODELS: ModelRow[] = [
  { id: "luna", display_name: "GPT-5.6 Luna", min_tier: null, is_default: true, sort_order: 0, tone: "success" },
  { id: "flash", display_name: "DeepSeek V4 Flash", min_tier: null, sort_order: 1 },
  { id: "reasoner", display_name: "DeepSeek Reasoner", min_tier: "pro", sort_order: 2 },
  { id: "frontier", display_name: "Frontier", min_tier: "ultra", sort_order: 3 },
];

describe("what a free account sees", () => {
  const list = decorateModels(MODELS, PLANS, "free");

  it("always offers Auto first, unlocked", () => {
    // "Server decides" cannot be gated, and it is the safe fallback when a
    // selected model turns out to be locked.
    expect(list[0]).toEqual(AUTO_MODEL);
    expect(list[0].locked).toBe(false);
  });

  it("locks the paid models and leaves the free ones alone", () => {
    const byId = Object.fromEntries(list.map((entry) => [entry.id, entry]));
    expect(byId.luna.locked).toBe(false);
    expect(byId.flash.locked).toBe(false);
    expect(byId.reasoner.locked).toBe(true);
    expect(byId.frontier.locked).toBe(true);
  });

  it("labels each one with the plan it needs, in words", () => {
    const byId = Object.fromEntries(list.map((entry) => [entry.id, entry]));
    // Not the raw key: "pro" is not what a user calls their plan.
    expect(byId.luna.badge).toBe("FREE");
    expect(byId.reasoner.badge).toBe("PRO");
    expect(byId.frontier.badge).toBe("ULTRA");
  });
});

describe("what a paying account sees", () => {
  it("unlocks its own tier and everything below", () => {
    const byId = Object.fromEntries(
      decorateModels(MODELS, PLANS, "pro").map((entry) => [entry.id, entry]),
    );
    expect(byId.reasoner.locked).toBe(false);
    // Compared by rank, so Pro does not accidentally unlock Ultra.
    expect(byId.frontier.locked).toBe(true);
  });

  it("unlocks everything at the top tier", () => {
    const list = decorateModels(MODELS, PLANS, "ultra");
    expect(list.every((entry) => !entry.locked)).toBe(true);
  });
});

describe("edge cases that decide who gets billed", () => {
  it("treats an unknown tier as the lowest, not the highest", () => {
    // A typo in a profile row must not hand out the paid models.
    const byId = Object.fromEntries(
      decorateModels(MODELS, PLANS, "enterprise-typo").map((entry) => [entry.id, entry]),
    );
    expect(byId.reasoner.locked).toBe(true);
  });

  it("keeps a model gated when its plan row has been removed", () => {
    // Falling back to "free" here would silently give away a paid model.
    const orphan: ModelRow[] = [{ id: "x", display_name: "X", min_tier: "retired-plan" }];
    const [, model] = decorateModels(orphan, PLANS, "free");
    expect(model.locked).toBe(true);
    expect(model.badge).toBe("RETIRED-PLAN");
  });

  it("drops inactive models rather than showing them as locked", () => {
    // Switched off is a statement about the model, not about this user's plan;
    // showing it would advertise an upgrade that buys nothing.
    const withOff: ModelRow[] = [
      ...MODELS,
      { id: "broken", display_name: "Broken", is_active: false },
    ];
    const list = decorateModels(withOff, PLANS, "ultra");
    expect(list.find((entry) => entry.id === "broken")).toBeUndefined();
  });

  it("orders by sort_order so the admin controls the sequence", () => {
    const shuffled = [MODELS[3], MODELS[1], MODELS[2], MODELS[0]];
    const ids = decorateModels(shuffled, PLANS, "ultra").map((entry) => entry.id);
    expect(ids).toEqual(["auto", "luna", "flash", "reasoner", "frontier"]);
  });

  it("falls back to a safe tone for a colour token that is not one", () => {
    const odd: ModelRow[] = [{ id: "x", display_name: "X", tone: "rainbow" }];
    const [, model] = decorateModels(odd, PLANS, "free");
    expect(model.tone).toBe("brandPrimary");
  });
});

describe("the two ranks fail closed in opposite directions", () => {
  it("ranks a tier the user holds lowest when it is unknown", () => {
    expect(heldRank(PLANS, null)).toBe(0);
    expect(heldRank(PLANS, undefined)).toBe(0);
    expect(heldRank(PLANS, "nope")).toBe(0);
    expect(heldRank(PLANS, "ultra")).toBe(2);
  });

  it("ranks a tier a model demands highest when it is unknown", () => {
    // No key at all means free, which is the one case that must stay open.
    expect(requiredRank(PLANS, null)).toBe(0);
    // A named plan that no longer exists locks the model rather than freeing it.
    expect(requiredRank(PLANS, "retired-plan")).toBe(Number.POSITIVE_INFINITY);
    expect(requiredRank(PLANS, "pro")).toBe(1);
  });
});

describe("when the product sells nothing", () => {
  const PLANS = [
    { key: "pro", display_name: "Pro", sort_order: 1 },
    { key: "ultra", display_name: "Ultra", sort_order: 2 },
  ];
  const MODELS = [
    { id: "free-one", display_name: "Free One", min_tier: null, is_default: true, sort_order: 0, tone: "success" },
    { id: "gated", display_name: "Gated", min_tier: "pro", is_default: false, sort_order: 1, tone: "warning" },
  ];

  it("locks nothing, because there is no way to unlock it", () => {
    // A padlock the user cannot open is a dead end. With billing off, a model
    // that would be gated is simply available.
    const models = decorateModels(MODELS as never, PLANS as never, "free", false);
    expect(models.every((m) => !m.locked)).toBe(true);
    expect(models.find((m) => m.id === "gated")?.minTier).toBe(null);
  });

  it("shows no tier badge, since every row would say the same thing", () => {
    const models = decorateModels(MODELS as never, PLANS as never, "free", false);
    expect(models.map((m) => m.badge)).toEqual(["", "", ""]);
  });

  it("still gates correctly when billing is on", () => {
    // The default has to stay what it was, or turning billing back on is a
    // migration rather than a flag.
    const models = decorateModels(MODELS as never, PLANS as never, "free", true);
    expect(models.find((m) => m.id === "gated")?.locked).toBe(true);
    expect(models.find((m) => m.id === "gated")?.badge).toBe("PRO");
    expect(models.find((m) => m.id === "free-one")?.badge).toBe("FREE");
  });

  it("a paid account still sees what it paid for", () => {
    const models = decorateModels(MODELS as never, PLANS as never, "pro", true);
    expect(models.find((m) => m.id === "gated")?.locked).toBe(false);
  });
});
