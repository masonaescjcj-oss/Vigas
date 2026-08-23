/**
 * frontend/src/services/distributionChannel.ts
 * ---------------------------------------------------------------------------
 * Which build this is, read once.
 *
 * Split from core/billing/distribution.ts so the rules stay testable without
 * react-native. This is only the part that reads the environment.
 *
 * Build time, not runtime, and deliberately. Android can be asked which store
 * installed it, but that needs a native module, and the answer would then differ
 * between a Play install and a sideload of the same binary — which is precisely
 * the ambiguity that gets a policy call wrong. A build knows what it is.
 *
 *   Play build:   EXPO_PUBLIC_DISTRIBUTION=play
 *   APK / Bazaar: EXPO_PUBLIC_DISTRIBUTION=direct
 *   Web:          anything; the platform decides
 * ---------------------------------------------------------------------------
 */

import { Platform } from "react-native";
import {
  normaliseChannel,
  type PurchaseAffordance,
  purchaseAffordance,
} from "../core/billing/distribution";

export const CHANNEL = normaliseChannel(process.env.EXPO_PUBLIC_DISTRIBUTION);

/** What this build may do about selling. Constant for the life of the process. */
export const PURCHASES: PurchaseAffordance = purchaseAffordance(Platform.OS, CHANNEL);
