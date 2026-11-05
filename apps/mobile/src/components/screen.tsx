import { RefreshControl, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

/**
 * Edge-to-edge: content scrolls under the status bar, so tab screens lay this translucent strip over
 * the status-bar inset to keep the clock and icons legible.
 */
export function StatusScrim() {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={[styles.scrim, { height: insets.top }]} />;
}

/** Pull-to-refresh in brand colors. */
export function Refresher(props: Omit<RefreshControlProps, 'colors' | 'progressBackgroundColor' | 'tintColor'>) {
  return <RefreshControl colors={[colors.orange]} progressBackgroundColor={colors.raised} tintColor={colors.orange} {...props} />;
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.scrim },
});
