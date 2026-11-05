import { Pressable, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { colors, GUTTER } from '@/theme';

import { T } from './text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  height?: number;
  role?: 'tab' | 'button';
}

/** Filter chip: outlined, inverts to ink when selected. */
export function Chip({ label, selected = false, onPress, height = 40, role = 'button' }: ChipProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ selected }}
      hitSlop={{ top: (48 - height) / 2, bottom: (48 - height) / 2 }}
      android_ripple={{ color: 'rgba(239,234,225,0.12)' }}
      onPress={() => {
        if (!selected) haptics.select();
        onPress?.();
      }}
      style={[
        styles.chip,
        { minHeight: height },
        selected ? styles.on : styles.off,
      ]}
    >
      <T f="sansMedium" size={14} color={selected ? colors.bg : colors.ink2}>
        {label}
      </T>
    </Pressable>
  );
}

export interface ChipRowProps<K extends string> {
  options: readonly { id: K; label: string }[];
  value: K;
  onChange: (id: K) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  height?: number;
}

/** Horizontally scrolling chip filter (`.hs` row in the design). */
export function ChipRow<K extends string>({ options, value, onChange, style, accessibilityLabel, height }: ChipRowProps<K>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.row}
      style={style}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((o) => (
        <Chip key={o.id} role="tab" label={o.label} selected={o.id === value} onPress={() => onChange(o.id)} height={height} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: GUTTER, gap: 8 },
  chip: {
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  on: { backgroundColor: colors.ink, borderColor: colors.ink },
  off: { backgroundColor: 'transparent', borderColor: colors.line2 },
});
