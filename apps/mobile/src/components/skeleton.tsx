import { useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Breathing placeholder block shown while a request is in flight. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const o = useSharedValue(0.55);
  useEffect(() => {
    o.set(withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [o]);
  const pulse = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.raised }, pulse, style]} />;
}

/** A row placeholder: square + two lines. */
export function SkeletonRow({ square = 42 }: { square?: number }) {
  return (
    <View
      accessibilityLabel="Loading"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line }}
    >
      <Skeleton width={square} height={square} radius={12} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="85%" height={12} />
      </View>
    </View>
  );
}
