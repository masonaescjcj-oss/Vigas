import * as Haptics from 'expo-haptics';

/** Fire-and-forget haptics. Devices without a vibrator (or with it disabled) just ignore these. */
const safe = (p: Promise<void>) => {
  p.catch(() => undefined);
};

export const haptics = {
  /** Tab change, segment change, chip selection. */
  select: () => safe(Haptics.selectionAsync()),
  /** Light tap: upvote, send, small buttons. */
  tap: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Heavier tap: primary key buttons. */
  press: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
