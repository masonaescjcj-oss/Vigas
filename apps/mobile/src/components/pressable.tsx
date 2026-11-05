import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { colors } from '@/theme';

import { Icon, type IconName } from './icons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Scale while pressed. */
  scaleTo?: number;
  haptic?: keyof typeof haptics | false;
}

/** Cards, rows and chips: shrink a touch while pressed and spring back. */
export function PressableScale({
  style,
  children,
  scaleTo = 0.975,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  accessibilityRole = 'button',
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      {...rest}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, { duration: 110 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 260, mass: 0.6 }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) haptics[haptic]();
        onPress?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  icon: IconName;
  accessibilityLabel: string;
  color?: string;
  size?: number;
  iconSize?: number;
  fill?: string;
  /** Square tile (Wallet key rows) instead of a round ghost button. */
  variant?: 'ghost' | 'tile';
  style?: StyleProp<ViewStyle>;
  haptic?: keyof typeof haptics | false;
}

/** 44dp icon button (`.ib` in the design) with a Material ripple. */
export function IconButton({
  icon,
  color = colors.ink,
  size = 44,
  iconSize = 22,
  fill,
  variant = 'ghost',
  style,
  haptic = false,
  onPress,
  ...rest
}: IconButtonProps) {
  const tile = variant === 'tile';
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={size < 44 ? (44 - size) / 2 : undefined}
      android_ripple={{ color: 'rgba(239,234,225,0.14)', borderless: !tile, radius: tile ? undefined : size / 2 }}
      onPress={(e) => {
        if (haptic) haptics[haptic]();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.ib,
        { width: size, height: size, borderRadius: tile ? 12 : size / 2 },
        tile && styles.tile,
        pressed && !tile && styles.pressed,
        style,
      ]}
      {...rest}
    >
      <Icon name={icon} size={iconSize} color={color} fill={fill} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ib: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tile: { backgroundColor: colors.raised },
  pressed: { backgroundColor: colors.raised },
});
