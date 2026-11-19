/**
 * frontend/src/services/adminFormat.ts
 * ---------------------------------------------------------------------------
 * How the admin panel reads and writes the numbers it shows.
 *
 * Pure, and kept out of adminService so it can be tested without loading a
 * Supabase client — and because the blank-means-unlimited rule is the kind of
 * thing that deserves tests rather than a comment.
 * ---------------------------------------------------------------------------
 */

import { formatCount } from "./formatting";

export type KeyHealth = "working" | "resting" | "off" | "untested";

/** The subset of a pooled key that decides how it is shown. */
export interface KeyHealthInput {
  is_active: boolean;
  exhausted_at: string | null;
  last_ok_at: string | null;
}

/** One word for the state of a key, so the list reads at a glance. */
export function keyHealth(key: KeyHealthInput): KeyHealth {
  if (!key.is_active) return "off";
  if (key.exhausted_at) return "resting";
  if (key.last_ok_at) return "working";
  return "untested";
}

export function healthLabel(health: KeyHealth): string {
  switch (health) {
    case "working": return "Working";
    case "resting": return "Out of credit — resting";
    case "off": return "Disabled";
    case "untested": return "Never worked";
  }
}

/** Null is a real value in the plans table: it means no limit at all. */
export function limitLabel(value: number | null): string {
  return value === null ? "Unlimited" : formatCount(value);
}

/**
 * Reads a limit field back. A blank box means unlimited, never zero — zero
 * would lock a whole tier out of building.
 */
export function parseLimit(text: string): number | null {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed || trimmed === "unlimited" || trimmed === "∞") return null;
  const parsed = Number(trimmed.replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}
