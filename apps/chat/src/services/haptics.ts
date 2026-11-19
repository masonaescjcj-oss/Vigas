/**
 * frontend/src/services/haptics.ts
 * ---------------------------------------------------------------------------
 * Small, deliberate haptic feedback.
 *
 * Wrapped rather than called directly for three reasons: the web has no haptics
 * (expo-haptics rejects there, and an unhandled rejection per tap is not worth
 * it), the user can turn it off, and vibration should describe *what happened*
 * — a tap, a completed run, a failure — not be sprinkled on every press.
 *
 * Every call is fire-and-forget. Feedback that fails is never worth surfacing.
 * ---------------------------------------------------------------------------
 */

import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

let enabled = true;

/** Settings toggle. Off means silent, not "lighter". */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

const supported = Platform.OS === "ios" || Platform.OS === "android";

function run(effect: () => Promise<unknown>): void {
  if (!enabled || !supported) return;
  void effect().catch(() => {
    // A device without a motor, or one that refuses mid-gesture. Not an error.
  });
}

/** A control was tapped. The lightest tick there is. */
export function tapFeedback(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** A choice landed — a mode switch, a model picked. */
export function selectionFeedback(): void {
  run(() => Haptics.selectionAsync());
}

/** A message was sent; something is now in flight. */
export function sendFeedback(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** The agent finished, or an answer arrived. */
export function successFeedback(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Something failed. Distinct enough to feel wrong without being alarming. */
export function errorFeedback(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

/** About to do something destructive — a rollback, a delete. */
export function warningFeedback(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
