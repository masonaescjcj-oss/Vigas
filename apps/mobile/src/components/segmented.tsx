import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { colors } from '@/theme';

import { T } from './text';

export interface SegmentedProps<K extends string> {
  options: ReadonlyArray<{ id: K; label: string }>;
  value: K;
  onChange: (id: K) => void;
  /** `light`: ink pill, dark text (Explore). `dark`: graphite pill, ink text (Chat mode). */
  tone?: 'light' | 'dark';
  height?: number;
  fontSize?: number;
  /** Stretch segments to the container width (grid) or size to content (inline). */
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const PAD = 3;

/** Pill segmented control whose indicator slides between options. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  tone = 'light',
  height = 42,
  fontSize = 15,
  stretch = true,
  style,
  accessibilityLabel,
}: SegmentedProps<K>) {
  const [widths, setWidths] = useState<number[]>(() => options.map(() => 0));
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const x = useSharedValue(0);
  const w = useSharedValue(0);

  const offset = widths.slice(0, index).reduce((a, b) => a + b, 0);
  const width = widths[index] ?? 0;

  useEffect(() => {
    if (width === 0) return;
    const first = w.get() === 0;
    const cfg = { damping: 20, stiffness: 240, mass: 0.7 };
    x.set(first ? offset : withSpring(offset, cfg));
    w.set(first ? width : withSpring(width, cfg));
  }, [offset, width, x, w]);

  const pill = useAnimatedStyle(() => ({ width: w.get(), transform: [{ translateX: x.get() }] }));
  const light = tone === 'light';

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, !stretch && styles.inline, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.pill, { height, backgroundColor: light ? colors.ink : colors.strong }, pill]}
      />
      {options.map((o, i) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onLayout={(e) => {
              const lw = e.nativeEvent.layout.width;
              setWidths((prev) => (prev[i] === lw ? prev : prev.map((v, k) => (k === i ? lw : v))));
            }}
            onPress={() => {
              if (!selected) {
                haptics.select();
                onChange(o.id);
              }
            }}
            style={[styles.seg, { minHeight: height }, stretch ? styles.flex : styles.padded]}
          >
            <T f="sansMedium" size={fontSize} color={selected ? (light ? colors.bg : colors.ink) : colors.ink2}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 999,
    padding: PAD,
    backgroundColor: colors.bg2,
  },
  inline: { alignSelf: 'flex-start' },
  pill: { position: 'absolute', top: PAD, left: PAD, borderRadius: 999 },
  seg: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: 13 },
});
