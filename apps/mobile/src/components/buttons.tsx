import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { colors } from '@/theme';

import { T } from './text';

const EDGE = 3;

export interface KeyButtonProps {
  label?: string;
  onPress?: () => void;
  icon?: ReactNode;
  /** Height of the orange face. */
  height?: number;
  /** Circular icon-only key (send button). */
  round?: boolean;
  radius?: number;
  fontSize?: number;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  haptic?: keyof typeof haptics | false;
}

/**
 * The orange "key" button: an orange face sitting on a darker 3px edge (`box-shadow: 0 3px 0 #A8420C`).
 * Pressing pushes the face down onto the edge like a physical key.
 */
export function KeyButton({
  label,
  onPress,
  icon,
  height = 44,
  round = false,
  radius,
  fontSize = 14,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
  haptic = 'press',
}: KeyButtonProps) {
  const down = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: down.get() * 2 }] }));
  const r = round ? height / 2 : (radius ?? 14);
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPressIn={() => down.set(withTiming(1, { duration: 60 }))}
      onPressOut={() => down.set(withTiming(0, { duration: 140 }))}
      onPress={() => {
        if (haptic) haptics[haptic]();
        onPress?.();
      }}
      style={[{ paddingBottom: EDGE, borderRadius: r }, round && { width: height }, disabled && styles.disabled, style]}
    >
      <View style={[styles.edge, { borderRadius: r, top: EDGE }]} />
      <Animated.View
        style={[
          styles.face,
          { height, borderRadius: r, paddingHorizontal: round ? 0 : 16 },
          face,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.onOrange} size="small" />
        ) : (
          <>
            {icon}
            {label ? (
              <T f="sansSemi" size={fontSize} color={colors.onOrange} numberOfLines={1}>
                {label}
              </T>
            ) : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

export interface GhostButtonProps {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  color?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
}

/** Outlined secondary button ("New key"). */
export function GhostButton({ label, onPress, icon, style, color = colors.ink, accessibilityLabel, disabled }: GhostButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      android_ripple={{ color: 'rgba(239,234,225,0.1)' }}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.ghost, pressed && { backgroundColor: colors.raised }, disabled && styles.disabled, style]}
    >
      {icon}
      <T f="sansMedium" size={14} color={color}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.orangeEdge },
  face: {
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  ghost: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  disabled: { opacity: 0.45 },
});
