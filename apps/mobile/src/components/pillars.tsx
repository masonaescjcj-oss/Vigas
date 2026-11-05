import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme';

import { OrgMonogram } from './monogram';
import { PressableScale } from './pressable';
import { T } from './text';

/** Fill/groove/value colors by place: orange for #1, sand for #2–3, graphite after. */
export function pillarTone(index: number) {
  if (index === 0) return { fill: colors.orange, groove: colors.orangeDeep, value: colors.orange };
  if (index < 3) return { fill: colors.sand, groove: colors.sandDeep, value: colors.sand };
  return { fill: colors.pillar, groove: colors.grooveDark, value: colors.ink2 };
}

export interface FlutedPillarProps {
  height: number;
  fill: string;
  groove: string;
  capWidth?: DimensionValue;
  capHeight?: number;
  shaftWidth?: DimensionValue;
  baseWidth?: DimensionValue | null;
  flutes?: number;
  delay?: number;
}

/**
 * A fluted column: capital, a shaft of vertical flutes separated by 1px grooves, and an optional base.
 * The shaft rises from zero on mount and re-animates when its height changes.
 */
export function FlutedPillar({
  height,
  fill,
  groove,
  capWidth = '84%',
  capHeight = 6,
  shaftWidth = '60%',
  baseWidth = '92%',
  flutes = 6,
  delay = 0,
}: FlutedPillarProps) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.set(withDelay(delay, withTiming(height, { duration: 700, easing: Easing.out(Easing.cubic) })));
  }, [height, delay, h]);
  const shaft = useAnimatedStyle(() => ({ height: h.get() }));

  return (
    <View style={styles.pillar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: capWidth, height: capHeight, borderRadius: 2, backgroundColor: fill }} />
      <Animated.View style={[styles.shaft, { width: shaftWidth, backgroundColor: groove }, shaft]}>
        {Array.from({ length: flutes }, (_, i) => (
          <View key={i} style={[styles.flute, { backgroundColor: fill }]} />
        ))}
      </Animated.View>
      {baseWidth !== null ? <View style={{ width: baseWidth, height: capHeight, borderRadius: 2, backgroundColor: fill }} /> : null}
    </View>
  );
}

export interface ColonnadeItem {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
}

/** Home "Top agents": five pillars scaled to the leader. */
export function Colonnade({ items, onPress, maxHeight = 110 }: { items: ColonnadeItem[]; onPress?: (item: ColonnadeItem) => void; maxHeight?: number }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <View style={styles.colonnade}>
      {items.map((item, i) => {
        const tone = pillarTone(i);
        return (
          <PressableScale
            key={item.key}
            accessibilityLabel={`${i + 1}. ${item.label}, ${item.valueLabel} win share`}
            onPress={() => onPress?.(item)}
            style={styles.column}
          >
            <T f="mono" size={12} color={tone.value}>
              {item.valueLabel}
            </T>
            <FlutedPillar height={Math.max(8, Math.round((item.value / max) * maxHeight))} fill={tone.fill} groove={tone.groove} flutes={6} delay={i * 70} />
            <T size={12} lh={1.2} color={colors.ink2} align="center" numberOfLines={2} style={styles.colName}>
              {item.label}
            </T>
          </PressableScale>
        );
      })}
    </View>
  );
}

export interface PodiumPlace {
  key: string;
  name: string;
  org: string;
  valueLabel: string;
  /** 0-based place. */
  place: number;
}

const PODIUM_HEIGHTS = [120, 84, 60];
const NUMERALS = ['I', 'II', 'III'];

/** Ranks podium: II · I · III on fluted pillars with plinths. */
export function Podium({ places, onPress }: { places: PodiumPlace[]; onPress?: (p: PodiumPlace) => void }) {
  const order = [1, 0, 2].map((i) => places[i]).filter((p): p is PodiumPlace => !!p);
  return (
    <View style={styles.podium}>
      {order.map((p) => {
        const tone = p.place === 0 ? pillarTone(0) : pillarTone(1);
        return (
          <PressableScale
            key={p.key}
            accessibilityLabel={`Rank ${p.place + 1}: ${p.name}, ${p.valueLabel}`}
            onPress={() => onPress?.(p)}
            style={styles.place}
          >
            <OrgMonogram org={p.org} size={36} radius={11} />
            <T f="sansMedium" size={13} lh={1.2} align="center" numberOfLines={2} style={styles.placeName}>
              {p.name}
            </T>
            <T f="serif" size={28} lh={1} color={tone.value} style={styles.placeValue}>
              {p.valueLabel}
            </T>
            <FlutedPillar
              height={PODIUM_HEIGHTS[p.place] ?? 60}
              fill={tone.fill}
              groove={tone.groove}
              capWidth="86%"
              capHeight={8}
              shaftWidth="62%"
              baseWidth={null}
              flutes={7}
              delay={p.place * 90}
            />
            <View style={styles.plinth}>
              <T f="serif" size={24} lh={1} color={tone.value}>
                {NUMERALS[p.place]}
              </T>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pillar: { width: '100%', alignItems: 'center', gap: 2 },
  shaft: { flexDirection: 'row', gap: 1, overflow: 'hidden' },
  flute: { flex: 1 },
  colonnade: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 190 },
  column: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  colName: { minHeight: 30 },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  place: { flex: 1, minWidth: 0, alignItems: 'center' },
  placeName: { marginTop: 6, minHeight: 32 },
  placeValue: { marginTop: 2, marginBottom: 10 },
  plinth: {
    width: '100%',
    height: 42,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderTopWidth: 1,
    borderTopColor: colors.line2,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
});
